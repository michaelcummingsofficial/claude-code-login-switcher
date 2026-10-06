import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "./detectActiveProfile";
import { isSuperseded } from "./isSuperseded";
import type { Profile, ProfileStore } from "./ProfileStore";
import { refreshTokenExpiryOf } from "./refreshTokenExpiryOf";
import { subscriptionTypeOf } from "./subscriptionTypeOf";

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
		if (!id) {
			return;
		}

		const saved = await store.credentialsFor(id);
		// The same account can be live in a workspace login too. Whichever refreshed last holds the usable tokens.
		if (saved === live || (saved !== null && isSuperseded(live, saved))) {
			return;
		}

		const patch: Partial<Profile> = { refreshTokenExpiresAt: refreshTokenExpiryOf(live) };
		const subscriptionType = subscriptionTypeOf(live);
		// Claude Code records the plan with the tokens, so an upgrade shows up here without a new login.
		if (subscriptionType) {
			patch.subscriptionType = subscriptionType;
		}

		await store.update(id, patch, live);
	} catch (error) {
		console.error("[claudeAccounts] sync failed", (error as Error).message);
	}
}
