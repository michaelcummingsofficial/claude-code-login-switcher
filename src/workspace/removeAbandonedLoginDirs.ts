import fs from "node:fs/promises";
import path from "node:path";
import type { ProfileStore } from "../profiles/ProfileStore";
import { loginDirFor } from "./loginDirFor";
import { removeLoginDir } from "./removeLoginDir";

/** Long past any login still in progress in another window, which owns a folder no account is saved under yet. */
const ABANDONED_AFTER_MS = 60 * 60_000;

/**
 * A login that was cancelled or crashed leaves its folder behind, and a Claude Code session started during a
 * login can recreate one after it was deleted. Each keeps a Keychain item on macOS.
 */
export async function removeAbandonedLoginDirs(store: ProfileStore): Promise<void> {
	const saved = new Set((await store.list()).map((profile) => profile.id));
	const entries = await fs.readdir(path.join(store.dir, "logins"), { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		const dir = loginDirFor(store.dir, entry.name);
		if (!entry.isDirectory() || saved.has(entry.name) || dir === process.env.CLAUDE_CONFIG_DIR) {
			continue;
		}

		const { mtimeMs } = await fs.stat(dir);
		if (Date.now() - mtimeMs > ABANDONED_AFTER_MS) {
			await removeLoginDir(store.dir, entry.name);
		}
	}
}
