import { isLaterLogin } from "./isLaterLogin";
import { oauthTimestampOf } from "./oauthTimestampOf";

/**
 * Every refresh pushes the access token's expiry forward and retires the tokens before it, so the later expiry
 * marks the copy Claude Code can still use. A later sign-in wins first: a login renewed early is newer than the
 * old one even while the old one keeps refreshing.
 */
export function isSuperseded(credentials: string, by: string): boolean {
	if (isLaterLogin(credentials, by)) {
		return false;
	}

	return isLaterLogin(by, credentials) || (oauthTimestampOf(by, "expiresAt") ?? 0) > (oauthTimestampOf(credentials, "expiresAt") ?? 0);
}
