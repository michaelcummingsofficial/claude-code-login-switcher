import fs from "node:fs/promises";
import path from "node:path";
import type { ProfileStore } from "../profiles/ProfileStore";
import { ensureLoginDir } from "./ensureLoginDir";

/**
 * A Claude Code session can outlive the links in its folder, or a folder can predate a shared entry. Each folder
 * gets its links back, and anything real Claude Code wrote there moves home. No folder is ever removed, because a
 * session in another window may still be using it.
 */
export async function healLoginDirs(store: ProfileStore): Promise<void> {
	const entries = await fs.readdir(path.join(store.dir, "logins"), { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		if (entry.isDirectory()) {
			await ensureLoginDir(store.dir, entry.name);
		}
	}
}
