import * as vscode from "vscode";
import type { Profile, ProfileStore } from "./ProfileStore";

/** Resolves `undefined` when nothing is saved or the picker is dismissed. */
export async function pickSavedProfile(store: ProfileStore, title: string): Promise<Profile | undefined> {
	const profiles = await store.list();
	if (profiles.length === 0) {
		void vscode.window.showInformationMessage("No saved Claude accounts.");
		return undefined;
	}

	const picked = await vscode.window.showQuickPick(
		profiles.map((profile) => ({ label: profile.label, description: profile.email, profile })),
		{ title }
	);
	return picked?.profile;
}
