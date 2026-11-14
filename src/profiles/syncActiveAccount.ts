import { readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { getSettings } from "../settings/getSettings";
import { detectActiveProfile } from "./detectActiveProfile";
import { isLaterLogin } from "./isLaterLogin";
import { isLoginEnded } from "./isLoginEnded";
import { isSameAccount } from "./isSameAccount";
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
		const liveCredential = await resolveLiveCredential();
		const live = await liveCredential.read();
		if (!live) {
			return;
		}

		const id = (await store.activeId()) ?? (await detectActiveProfile(store, live))?.id;
		if (!id) {
			return;
		}

		const saved = await store.credentialsFor(id);
		if (saved === live) {
			return;
		}

		// The same account can be live in a workspace login too. Whichever refreshed last holds the usable tokens.
		if (saved !== null && isSuperseded(live, saved)) {
			/**
			 * Logging in again from a workspace renews only that workspace's folder. Every other login of the
			 * account keeps the old sign-in, or stays cleared, and Claude Code asks to sign in there again.
			 */
			const replaceable = isLoginEnded(live) || isLaterLogin(saved, live);
			if (replaceable && (refreshTokenExpiryOf(saved) ?? Infinity) > Date.now()) {
				await liveCredential.write(saved);
			}

			return;
		}

		// A later sign-in the extension did not make may be someone else's, so it is kept only once Claude Code names the account.
		if (saved !== null && isLaterLogin(live, saved) && !(await isSignedInAs(store, id))) {
			await store.setActive(null);
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

async function isSignedInAs(store: ProfileStore, id: string): Promise<boolean> {
	const status = await readAuthStatus(getSettings().claudePath);
	return status?.email !== undefined && (await store.list()).some((profile) => profile.id === id && isSameAccount(profile, status));
}
