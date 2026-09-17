import fs from "node:fs/promises";
import path from "node:path";

/**
 * Claude Code and other windows read these files at any moment, so a new version is written beside the old one
 * and renamed over it. Nobody ever reads half a file. The modes keep both readable by the owner only on macOS
 * and Linux; Windows ignores them and inherits the profile folder's access controls.
 */
export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
	const tmp = `${filePath}.tmp-${process.pid}`;
	await fs.writeFile(tmp, contents, { mode: 0o600 });
	await fs.rename(tmp, filePath);
}
