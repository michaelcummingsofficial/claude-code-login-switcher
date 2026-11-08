import { pickSavedProfile } from "../profiles/pickSavedProfile";
import type { ProfileStore } from "../profiles/ProfileStore";
import { addAccount } from "./addAccount";

/** `profileId` comes from the status bar, which renews the account it shows without asking which. */
export async function logInAgain(store: ProfileStore, profileId?: unknown): Promise<void> {
	const profile =
		(await store.list()).find((candidate) => candidate.id === profileId) ?? (await pickSavedProfile(store, "Log in again to a saved Claude account"));
	if (!profile) {
		return;
	}

	await addAccount(store, profile);
}
