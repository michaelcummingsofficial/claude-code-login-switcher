import type { Profile, ProfileStore } from "./ProfileStore";

/** Finds the saved profile holding exactly the live credentials and marks it active. */
export async function detectActiveProfile(store: ProfileStore, live: string): Promise<Profile | null> {
	for (const profile of await store.list()) {
		if ((await store.credentialsFor(profile.id)) === live) {
			await store.setActive(profile.id);
			return profile;
		}
	}

	return null;
}
