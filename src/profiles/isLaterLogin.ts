import { refreshTokenExpiryOf } from "./refreshTokenExpiryOf";

/**
 * Each sign-in fixes its refresh token's expiry, and refreshing never moves it, so a later expiry marks a later
 * sign-in. `false` when either login does not record one.
 */
export function isLaterLogin(credentials: string, than: string): boolean {
	const login = refreshTokenExpiryOf(credentials);
	const other = refreshTokenExpiryOf(than);
	return login !== undefined && other !== undefined && login > other;
}
