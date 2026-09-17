import * as vscode from "vscode";
import { pickSavedProfile } from "../profiles/pickSavedProfile";
import type { ProfileStore } from "../profiles/ProfileStore";

export async function removeAccount(store: ProfileStore): Promise<void> {
	const profile = await pickSavedProfile(store, "Remove a saved Claude account");
	if (!profile) {
		return;
	}

	const confirm = await vscode.window.showWarningMessage(
		`Remove "${profile.label}"? Its saved tokens are deleted. The live login is not touched.`,
		{ modal: true },
		"Remove"
	);
	if (confirm !== "Remove") {
		return;
	}

	await store.remove(profile.id);
}
