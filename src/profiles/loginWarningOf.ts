import { isLoginEnded } from "./isLoginEnded";
import type { Profile } from "./ProfileStore";

const DAY_MS = 86_400_000;
/** Claude Code starts its own "Your login expires" notice three days out. */
const WARNING_DAYS = 3;

export interface LoginWarning {
	expired: boolean;
	/** One sentence, such as "Login expires in 2 days." Callers add what to do about it. */
	message: string;
}

/**
 * Anthropic fixes the refresh token's expiry at login, and refreshing never moves it, so every account has
 * to log in again eventually. `live`, when given, is the account's live login, which may have ended early.
 * Resolves `undefined` while more than three days remain or the expiry is unknown.
 */
export function loginWarningOf(profile: Profile, live?: string | null): LoginWarning | undefined {
	const left = (profile.refreshTokenExpiresAt ?? Infinity) - Date.now();
	if ((live && isLoginEnded(live)) || left <= 0) {
		return { expired: true, message: "Login expired." };
	}

	const days = Math.ceil(left / DAY_MS);
	if (days > WARNING_DAYS) {
		return undefined;
	}

	return { expired: false, message: `Login expires in ${days} ${days === 1 ? "day" : "days"}.` };
}
