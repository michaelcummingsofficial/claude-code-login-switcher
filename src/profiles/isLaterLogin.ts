import { refreshTokenExpiryOf } from "./refreshTokenExpiryOf";

/**
 * Claude Code recomputes the expiry on every refresh, as now plus the whole seconds the server says are left, so
 * copies of one login drift apart by a second or so. A strict comparison would call every other refresh a sign-in.
 */
const REFRESH_DRIFT_MS = 60_000;

/**
 * Each sign-in starts a new refresh token lifetime, so an expiry later by more than the refresh drift marks a later
 * sign-in. `false` when either login does not record one.
 */
export function isLaterLogin(credentials: string, than: string): boolean {
	const login = refreshTokenExpiryOf(credentials);
	const other = refreshTokenExpiryOf(than);
	return login !== undefined && other !== undefined && login - other > REFRESH_DRIFT_MS;
}
