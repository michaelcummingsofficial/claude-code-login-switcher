export function refreshTokenExpiryOf(credentials: string): number | undefined {
	try {
		const oauth = (JSON.parse(credentials) as { claudeAiOauth?: { refreshTokenExpiresAt?: unknown } } | null)?.claudeAiOauth;
		return typeof oauth?.refreshTokenExpiresAt === "number" ? oauth.refreshTokenExpiresAt : undefined;
	} catch {
		return undefined;
	}
}
