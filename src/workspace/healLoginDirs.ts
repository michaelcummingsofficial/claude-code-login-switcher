import fs from "node:fs/promises";
import path from "node:path";
import type { ProfileStore } from "../profiles/ProfileStore";
import { ensureLoginDir } from "./ensureLoginDir";
import { isLockEntry } from "./isLockEntry";

/**
 * A Claude Code session can outlive the links in its folder, or a folder can predate a shared entry. Each folder
 * gets its links back, and anything real Claude Code wrote there moves home. No folder is ever removed, because a
 * session in another window may still be using it.
 */
export async function healLoginDirs(store: ProfileStore): Promise<void> {
	const logins = path.join(store.dir, "logins");
	const entries = await fs.readdir(logins, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		await (isLockEntry(entry.name) ? releaseLock(path.join(logins, entry.name)) : ensureLoginDir(store.dir, entry.name));
	}
}

/**
 * Claude Code holds `<login folder>.lock` while it refreshes the tokens and removes it with `rmdir`. Links put
 * inside one keep it from being removed, and a refresh that finds it changed in the last minute gives up. Claude
 * Code never writes into the folder, so any link there came from relinking it as a login.
 */
async function releaseLock(lock: string): Promise<void> {
	const links = (await fs.readdir(lock, { withFileTypes: true })).filter((entry) => entry.isSymbolicLink());
	if (links.length === 0) {
		return;
	}

	const { atime, mtime } = await fs.stat(lock);
	for (const link of links) {
		await fs.unlink(path.join(lock, link.name));
	}

	// Claude Code reads a lock changed in the last minute as held, and a window starts just as an expired login renews.
	await fs.utimes(lock, atime, mtime);
}
