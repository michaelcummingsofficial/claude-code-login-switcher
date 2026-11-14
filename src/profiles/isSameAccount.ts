import type { AuthStatus } from "../claude/readAuthStatus";
import type { Profile } from "./ProfileStore";

/** One email can belong to a personal plan and a Team organization, which are separate accounts. */
export function isSameAccount(profile: Profile, status: AuthStatus): boolean {
	return profile.email?.toLowerCase() === status.email?.toLowerCase() && (!profile.orgName || !status.orgName || profile.orgName === status.orgName);
}
