import fs from "node:fs/promises";
import path from "node:path";
import { getSettings } from "../settings/getSettings";
import { isPrivateEntry } from "./isPrivateEntry";
import { loginDirFor } from "./loginDirFor";
import { salvageLoginDir } from "./salvageLoginDir";
import { sharedConfigDir } from "./sharedConfigDir";
import { sharedPathOf } from "./sharedPathOf";

/**
 * Claude Code keeps one login per config folder, so an account used by a workspace gets a folder of its own.
 * Every entry but the login links back to the shared folder, which keeps history, settings, and MCP servers
 * the same everywhere.
 */
export async function ensureLoginDir(storeDir: string, id: string): Promise<string> {
	const dir = loginDirFor(storeDir, id);
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	await salvageLoginDir(storeDir, id);
	const names = new Set((await fs.readdir(sharedConfigDir()).catch(() => [])).filter((name) => !isPrivateEntry(name)));
	if (!getSettings().baseConfigDir) {
		names.add(".claude.json");
	}

	for (const name of names) {
		await link(sharedPathOf(name), path.join(dir, name));
	}

	return dir;
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
