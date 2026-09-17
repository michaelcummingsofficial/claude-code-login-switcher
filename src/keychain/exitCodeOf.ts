export function exitCodeOf(failure: unknown): number | null {
	const code = (failure as { code?: unknown } | null | undefined)?.code;
	return typeof code === "number" ? code : null;
}
