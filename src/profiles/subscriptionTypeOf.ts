import { oauthOf } from "./oauthOf";

export function subscriptionTypeOf(credentials: string): string | undefined {
	const value = oauthOf(credentials)?.subscriptionType;
	return typeof value === "string" ? value : undefined;
}
