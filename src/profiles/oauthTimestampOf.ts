import { oauthOf } from "./oauthOf";

export function oauthTimestampOf(credentials: string, field: "expiresAt" | "refreshTokenExpiresAt"): number | undefined {
	const value = oauthOf(credentials)?.[field];
	return typeof value === "number" ? value : undefined;
}
