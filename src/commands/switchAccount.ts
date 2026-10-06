import * as vscode from "vscode";
import { readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";
import { useWorkspaceAccount } from "../workspace/useWorkspaceAccount";
import { addAccount } from "./addAccount";
import { changeSwitchScope } from "./changeSwitchScope";
import { saveCurrentAccount } from "./saveCurrentAccount";

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
		detail: isExpired(profile) ? "Refresh token expired. Log in again to use this account." : undefined,
		profile
	}));
	items.push(
		{ label: "", kind: vscode.QuickPickItemKind.Separator },
		{ label: "$(add) Log in to another account", run: addAccount },
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

	// Until a workspace picks its own account it follows the shared one, so picking that one still pins it here.
	if (picked.profile.id !== (scoped ? settings.workspaceAccountId : activeId)) {
		await applyProfile(store, picked.profile, scoped);
	}
}

async function applyProfile(store: ProfileStore, profile: Profile, scoped: boolean): Promise<void> {
	const credentials = await store.credentialsFor(profile.id);
	if (!credentials) {
		void vscode.window.showErrorMessage(`Stored credentials for "${profile.label}" are missing. Log in again to re-save it.`);
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
		void vscode.window.showWarningMessage(`Claude Code does not see a login for "${profile.label}". Log in to it again with Add Account.`);
		return;
	}

	void vscode.window.showInformationMessage(
		scoped
			? `Switched this workspace to "${profile.label}". Open a new terminal or Claude session to use it.`
			: `Switched to "${profile.label}". Restart any running Claude session to use it.`
	);
}

function isExpired(profile: Profile): boolean {
	return profile.refreshTokenExpiresAt !== undefined && profile.refreshTokenExpiresAt < Date.now();
}
