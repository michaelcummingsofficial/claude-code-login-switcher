import { pickSavedProfile } from "../profiles/pickSavedProfile";
import type { ProfileStore } from "../profiles/ProfileStore";
import { promptForLabel } from "./promptForLabel";

export async function renameAccount(store: ProfileStore): Promise<void> {
	const profile = await pickSavedProfile(store, "Rename a saved Claude account");
	if (!profile) {
		return;
	}

	const label = await promptForLabel("Rename account", profile.label);
	if (!label) {
		return;
	}

	await store.update(profile.id, { label });
}
