import { oauthOf } from "./oauthOf";

/** Claude Code blanks the tokens once Anthropic refuses the refresh token, and only a new login brings them back. */
export function isLoginEnded(credentials: string): boolean {
	return oauthOf(credentials)?.refreshToken === "";
}
