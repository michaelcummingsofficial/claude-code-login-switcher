/** The login stays private to each folder, and lock folders come and go while Claude Code writes. */
export function isPrivateEntry(name: string): boolean {
	return name === ".credentials.json" || name.endsWith(".lock");
}
