import { oauthTimestampOf } from "./oauthTimestampOf";

export function refreshTokenExpiryOf(credentials: string): number | undefined {
	return oauthTimestampOf(credentials, "refreshTokenExpiresAt");
}
