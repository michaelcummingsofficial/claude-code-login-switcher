import * as vscode from "vscode";
import { readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "../profiles/detectActiveProfile";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { refreshTokenExpiryOf } from "../profiles/refreshTokenExpiryOf";
import { getSettings } from "../settings/getSettings";
import { promptForLabel } from "./promptForLabel";

/** Resolves the saved profile, or `null` when nothing was saved. */
export async function saveCurrentAccount(store: ProfileStore): Promise<Profile | null> {
	const liveCredential = await resolveLiveCredential();
	const live = await liveCredential.read();
	if (!live) {
		void vscode.window.showErrorMessage(`No Claude Code login found in ${liveCredential.location}. Run \`claude auth login\` first.`);
		return null;
	}

	const existing = await detectActiveProfile(store, live);
	if (existing) {
		void vscode.window.showInformationMessage(`This account is already saved as "${existing.label}".`);
		return existing;
	}

	const status = await readAuthStatus(getSettings().claudePath);
	const label = await promptForLabel(
		"Save current Claude account",
		status?.email ?? (status?.subscriptionType ? `${status.subscriptionType} account` : "Claude account")
	);
	if (!label) {
		return null;
	}

	const saved = await store.add(
		{
			label,
			email: status?.email,
			orgName: status?.orgName,
			subscriptionType: status?.subscriptionType,
			refreshTokenExpiresAt: refreshTokenExpiryOf(live)
		},
		live
	);
	void vscode.window.showInformationMessage(`Saved Claude account "${saved.label}".`);
	return saved;
}
