import * as vscode from "vscode";
import { readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { loginWarningOf } from "../profiles/loginWarningOf";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";
import { newestLoginOf } from "../workspace/newestLoginOf";
import { useWorkspaceAccount } from "../workspace/useWorkspaceAccount";
import { addAccount } from "./addAccount";
import { changeSwitchScope } from "./changeSwitchScope";
import { logInAgain } from "./logInAgain";
import { saveCurrentAccount } from "./saveCurrentAccount";

const LOG_IN_AGAIN = "Log in again";

type Mode = "workspace" | "everywhere" | "global";

/** `everywhere` signs the picked account in for every workspace, including ones that picked their own. */
export async function switchAccount(store: ProfileStore, everywhere = false): Promise<void> {
	await syncActiveAccount(store);
	const profiles = await store.list();
	if (profiles.length === 0) {
		const choice = await vscode.window.showInformationMessage("No Claude accounts saved yet.", "Save current account", "Log in to another account");
		if (choice === "Save current account") {
			await saveCurrentAccount(store);
		} else if (choice === "Log in to another account") {
			await addAccount(store);
		}

		return;
	}

	const activeId = await store.activeId();
	const sharedId = await store.sharedId();
	const perWorkspace = getSettings().switchScope === "workspace";
	const mode: Mode = everywhere ? "everywhere" : perWorkspace ? "workspace" : "global";
	const checkedId = everywhere ? sharedId : activeId;
	const items: (vscode.QuickPickItem & { profile?: Profile; run?: (store: ProfileStore) => Promise<void> })[] = profiles.map((profile) => ({
		label: profile.id === checkedId ? `$(check) ${profile.label}` : profile.label,
		description: [profile.email, profile.subscriptionType].filter(Boolean).join(" · "),
		detail:
			describeWarning(profile) ?? (mode === "workspace" && profile.id === sharedId ? "Shared by every workspace without its own account." : undefined),
		profile
	}));
	if (!everywhere) {
		items.push(
			{ label: "", kind: vscode.QuickPickItemKind.Separator },
			{ label: "$(add) Log in to another account", run: addAccount },
			{ label: "$(refresh) Log in again to a saved account", run: logInAgain },
			...(perWorkspace ? [{ label: "$(globe) Use an account everywhere", run: (accounts: ProfileStore) => switchAccount(accounts, true) }] : []),
			{ label: perWorkspace ? "$(gear) Applies to this workspace only" : "$(gear) Applies everywhere", description: "Change", run: changeSwitchScope }
		);
	}

	const picked = await vscode.window.showQuickPick(items, {
		title: everywhere ? "Use a Claude account everywhere" : "Switch Claude account",
		placeHolder: "Pick an account"
	});
	if (!picked) {
		return;
	}

	if (!picked.profile) {
		await picked.run?.(store);
		return;
	}

	// A switch to an expired login would leave Claude Code signed out, so picking one logs in to it instead.
	if (loginWarningOf(picked.profile)?.expired) {
		await addAccount(store, picked.profile);
		return;
	}

	// Picking the shared account everywhere still matters: it brings back workspaces that picked their own.
	if (everywhere || picked.profile.id !== activeId) {
		await applyProfile(store, picked.profile, mode);
	}
}

async function applyProfile(store: ProfileStore, profile: Profile, mode: Mode): Promise<void> {
	const credentials = await store.credentialsFor(profile.id);
	if (!credentials) {
		await offerLogin(store, profile, vscode.window.showErrorMessage(`The saved login for "${profile.label}" is missing.`, LOG_IN_AGAIN));
		return;
	}

	try {
		if (mode === "everywhere") {
			await store.setEverywhere(profile.id);
		}

		if (mode === "global") {
			// A workspace may have used the account more recently than the last sync, from a folder of its own.
			await (await resolveLiveCredential()).write((await newestLoginOf(store, profile.id)) ?? credentials);
			await store.setActive(profile.id);
		} else {
			await useWorkspaceAccount(store, profile.id);
		}
	} catch (error) {
		void vscode.window.showErrorMessage(`Could not switch account: ${(error as Error).message}`);
		return;
	}

	// Asking the CLI proves Claude Code finds the login where the switch put it. A CLI that cannot run proves nothing.
	const status = await readAuthStatus(getSettings().claudePath);
	if (status?.loggedIn === false) {
		await offerLogin(store, profile, vscode.window.showWarningMessage(`Claude Code does not see a login for "${profile.label}".`, LOG_IN_AGAIN));
		return;
	}

	const messages: Record<Mode, string> = {
		workspace: `Switched this workspace to "${profile.label}". Open a new terminal to use it there.`,
		everywhere: `Switched every workspace to "${profile.label}". Open windows follow when you go back to them.`,
		global: `Switched to "${profile.label}". Restart any Claude session running in a terminal to use it.`
	};
	void vscode.window.showInformationMessage(messages[mode]);
}

function describeWarning(profile: Profile): string | undefined {
	const warning = loginWarningOf(profile);
	return warning && `${warning.message} ${warning.expired ? "Pick it to log in again." : "Log in again to renew it."}`;
}

async function offerLogin(store: ProfileStore, profile: Profile, choice: Thenable<string | undefined>): Promise<void> {
	if ((await choice) === LOG_IN_AGAIN) {
		await addAccount(store, profile);
	}
}
