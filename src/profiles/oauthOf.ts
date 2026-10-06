/** The `claudeAiOauth` block of a stored login, or `undefined` when the login is not in Claude Code's format. */
export function oauthOf(credentials: string): Record<string, unknown> | undefined {
	try {
		return (JSON.parse(credentials) as { claudeAiOauth?: Record<string, unknown> } | null)?.claudeAiOauth;
	} catch {
		return undefined;
	}
}
