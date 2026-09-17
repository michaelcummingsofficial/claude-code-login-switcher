import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "./detectActiveProfile";
import type { ProfileStore } from "./ProfileStore";
import { refreshTokenExpiryOf } from "./refreshTokenExpiryOf";

/**
 * Claude Code rotates the tokens in place, so the copy saved for the active
 * account goes stale within the hour. Copy the live item back before anything
 * reads a saved one, or a switch away and back would hand Claude a dead token.
 */
export async function syncActiveAccount(store: ProfileStore): Promise<void> {
	try {
		const live = await (await resolveLiveCredential()).read();
		if (!live) {
			return;
		}

		const id = (await store.activeId()) ?? (await detectActiveProfile(store, live))?.id;
		if (!id || (await store.credentialsFor(id)) === live) {
			return;
		}

		await store.update(id, { refreshTokenExpiresAt: refreshTokenExpiryOf(live) }, live);
	} catch (error) {
		console.error("[claudeAccounts] sync failed", (error as Error).message);
	}
}
