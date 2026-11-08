import * as vscode from "vscode";
import { readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { loginWarningOf } from "../profiles/loginWarningOf";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";
import { useWorkspaceAccount } from "../workspace/useWorkspaceAccount";
import { addAccount } from "./addAccount";
import { changeSwitchScope } from "./changeSwitchScope";
import { logInAgain } from "./logInAgain";
import { saveCurrentAccount } from "./saveCurrentAccount";

const LOG_IN_AGAIN = "Log in again";

export async function switchAccount(store: ProfileStore): Promise<void> {
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
	const settings = getSettings();
	const scoped = settings.switchScope === "workspace";
	const items: (vscode.QuickPickItem & { profile?: Profile; run?: (store: ProfileStore) => Promise<void> })[] = profiles.map((profile) => ({
		label: profile.id === activeId ? `$(check) ${profile.label}` : profile.label,
		description: [profile.email, profile.subscriptionType].filter(Boolean).join(" · "),
		detail: describeWarning(profile),
		profile
	}));
	items.push(
		{ label: "", kind: vscode.QuickPickItemKind.Separator },
		{ label: "$(add) Log in to another account", run: addAccount },
		{ label: "$(refresh) Log in again to a saved account", run: logInAgain },
		{ label: scoped ? "$(gear) Applies to this workspace only" : "$(gear) Applies everywhere", description: "Change", run: changeSwitchScope }
	);
	const picked = await vscode.window.showQuickPick(items, { title: "Switch Claude account", placeHolder: "Pick an account" });
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

	// Until a workspace picks its own account it follows the shared one, so picking that one still pins it here.
	if (picked.profile.id !== (scoped ? settings.workspaceAccountId : activeId)) {
		await applyProfile(store, picked.profile, scoped);
	}
}

async function applyProfile(store: ProfileStore, profile: Profile, scoped: boolean): Promise<void> {
	const credentials = await store.credentialsFor(profile.id);
	if (!credentials) {
		await offerLogin(store, profile, vscode.window.showErrorMessage(`The saved login for "${profile.label}" is missing.`, LOG_IN_AGAIN));
		return;
	}

	try {
		if (scoped) {
			await useWorkspaceAccount(store, profile.id);
		} else {
			await (await resolveLiveCredential()).write(credentials);
			await store.setActive(profile.id);
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

	void vscode.window.showInformationMessage(
		scoped
			? `Switched this workspace to "${profile.label}". Open a new terminal to use it there.`
			: `Switched to "${profile.label}". Restart any Claude session running in a terminal to use it.`
	);
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
