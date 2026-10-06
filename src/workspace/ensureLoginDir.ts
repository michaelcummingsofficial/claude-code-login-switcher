import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSettings } from "../settings/getSettings";
import { loginDirFor } from "./loginDirFor";

/**
 * Claude Code keeps one login per config folder, so an account used by a workspace gets a folder of its own.
 * Every entry but the login links back to the shared folder, which keeps history, settings, and MCP servers
 * the same everywhere.
 */
export async function ensureLoginDir(storeDir: string, id: string): Promise<string> {
	const dir = loginDirFor(storeDir, id);
	const { baseConfigDir } = getSettings();
	const base = path.resolve(baseConfigDir || path.join(os.homedir(), ".claude"));
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	const shared = new Map((await namesIn(base)).map((name) => [name, path.join(base, name)]));
	if (!baseConfigDir) {
		// Without CLAUDE_CONFIG_DIR this file sits beside `~/.claude`. With it, Claude Code looks inside the folder.
		shared.set(".claude.json", path.join(os.homedir(), ".claude.json"));
	}

	for (const name of await namesIn(dir)) {
		if (!shared.has(name) && (await adopt(path.join(dir, name), path.join(base, name)))) {
			shared.set(name, path.join(base, name));
		}
	}

	for (const [name, target] of shared) {
		await link(target, path.join(dir, name));
	}

	return dir;
}

/** The login stays private to each folder, and lock folders come and go while Claude Code writes. */
async function namesIn(dir: string): Promise<string[]> {
	const names = await fs.readdir(dir).catch(() => []);
	return names.filter((name) => name !== ".credentials.json" && !name.endsWith(".lock"));
}

/** Moves something Claude Code created in the login folder into the shared one. Windows refuses while it is open. */
async function adopt(created: string, target: string): Promise<boolean> {
	try {
		if ((await fs.lstat(created)).isSymbolicLink()) {
			return false;
		}

		await fs.mkdir(path.dirname(target), { recursive: true });
		await fs.rename(created, target);
		return true;
	} catch {
		return false;
	}
}

async function link(target: string, linkPath: string): Promise<void> {
	const isDirectory = await fs.stat(target).then(
		(stats) => stats.isDirectory(),
		() => false
	);
	try {
		// Windows links folders as junctions without extra rights. Other systems ignore the type.
		await fs.symlink(target, linkPath, isDirectory ? "junction" : "file");
	} catch (error) {
		const { code } = error as NodeJS.ErrnoException;
		if (code === "EEXIST") {
			return;
		}

		if (code === "EPERM") {
			throw new Error("Windows blocked the links a workspace account needs. Turn on Developer Mode in Windows Settings, then switch again.");
		}

		throw error;
	}
}
