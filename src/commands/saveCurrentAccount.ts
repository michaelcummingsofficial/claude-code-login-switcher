import * as vscode from "vscode";
import { type AuthStatus, readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "../profiles/detectActiveProfile";
import { isSameAccount } from "../profiles/isSameAccount";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { refreshTokenExpiryOf } from "../profiles/refreshTokenExpiryOf";
import { getSettings } from "../settings/getSettings";
import { promptForLabel } from "./promptForLabel";

/**
 * A new login always brings new tokens, so a saved account is recognized by its email and organization. `target`
 * is the account the login was meant to renew, which wins unless Claude Code reports a different one.
 * Resolves the saved profile, or `null` when nothing was saved.
 */
export async function saveCurrentAccount(store: ProfileStore, target?: Profile): Promise<Profile | null> {
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
	const details = detailsOf(status, live);
	const missedTarget = target?.email !== undefined && status?.email !== undefined && !isSameAccount(target, status);
	if (missedTarget) {
		void vscode.window.showWarningMessage(`You logged in as ${status.email}, not "${target.label}".`);
	}

	const renewed = target && !missedTarget ? target : await findAccount(store, status);
	if (renewed) {
		await store.update(renewed.id, details, live);
		await store.setActive(renewed.id);
		void vscode.window.showInformationMessage(`Logged in to "${renewed.label}" again.`);
		return { ...renewed, ...details };
	}

	const label = await promptForLabel(
		"Save current Claude account",
		status?.email ?? (status?.subscriptionType ? `${status.subscriptionType} account` : "Claude account")
	);
	if (!label) {
		return null;
	}

	const saved = await store.add({ label, ...details }, live);
	void vscode.window.showInformationMessage(`Saved Claude account "${saved.label}".`);
	return saved;
}

/** Leaves out what `claude auth status` could not say, so an update keeps the details already saved. */
function detailsOf(status: AuthStatus | null, live: string): Omit<Profile, "id" | "label" | "savedAt"> {
	const details: Omit<Profile, "id" | "label" | "savedAt"> = { refreshTokenExpiresAt: refreshTokenExpiryOf(live) };
	for (const key of ["email", "orgName", "subscriptionType"] as const) {
		if (status?.[key]) {
			details[key] = status[key];
		}
	}

	return details;
}

async function findAccount(store: ProfileStore, status: AuthStatus | null): Promise<Profile | undefined> {
	return status?.email ? (await store.list()).find((profile) => isSameAccount(profile, status)) : undefined;
}
