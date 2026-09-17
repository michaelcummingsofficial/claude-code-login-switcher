import * as vscode from "vscode";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { addAccount } from "./addAccount";
import { saveCurrentAccount } from "./saveCurrentAccount";
import { showStatus } from "./showStatus";

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
	const items: (vscode.QuickPickItem & { profile?: Profile })[] = profiles.map((profile) => ({
		label: profile.id === activeId ? `$(check) ${profile.label}` : profile.label,
		description: [profile.email, profile.subscriptionType].filter(Boolean).join(" · "),
		detail: isExpired(profile) ? "Refresh token expired. Log in again to use this account." : undefined,
		profile
	}));
	items.push({ label: "", kind: vscode.QuickPickItemKind.Separator }, { label: "$(add) Log in to another account" });
	const picked = await vscode.window.showQuickPick(items, { title: "Switch Claude account", placeHolder: "Pick an account" });
	if (!picked) {
		return;
	}

	if (!picked.profile) {
		await addAccount(store);
		return;
	}

	if (picked.profile.id !== activeId) {
		await applyProfile(store, picked.profile);
	}
}

async function applyProfile(store: ProfileStore, profile: Profile): Promise<void> {
	const credentials = await store.credentialsFor(profile.id);
	if (!credentials) {
		void vscode.window.showErrorMessage(`Stored credentials for "${profile.label}" are missing. Log in again to re-save it.`);
		return;
	}

	try {
		await (await resolveLiveCredential()).write(credentials);
	} catch (error) {
		void vscode.window.showErrorMessage(`Could not switch account: ${(error as Error).message}`);
		return;
	}

	await store.setActive(profile.id);
	// Not awaited: a notification can sit unanswered, and the status bar refreshes once this command returns.
	void vscode.window
		.showInformationMessage(`Switched to "${profile.label}". Restart any running Claude session to use it.`, "Verify")
		.then((choice) => (choice === "Verify" ? showStatus(store) : undefined));
}

function isExpired(profile: Profile): boolean {
	return profile.refreshTokenExpiresAt !== undefined && profile.refreshTokenExpiresAt < Date.now();
}
