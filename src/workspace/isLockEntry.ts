/** Claude Code locks a file or folder by creating a `.lock` folder beside it, and removes it when done. */
export function isLockEntry(name: string): boolean {
	return name.endsWith(".lock");
}
