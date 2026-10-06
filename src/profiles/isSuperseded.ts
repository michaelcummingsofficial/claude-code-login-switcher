import { oauthTimestampOf } from "./oauthTimestampOf";

/**
 * Every refresh pushes the access token's expiry forward and retires the tokens before it, so the later expiry
 * marks the copy Claude Code can still use.
 */
export function isSuperseded(credentials: string, by: string): boolean {
	return (oauthTimestampOf(by, "expiresAt") ?? 0) > (oauthTimestampOf(credentials, "expiresAt") ?? 0);
}
