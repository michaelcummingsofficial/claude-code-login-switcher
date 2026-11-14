import fs from "node:fs/promises";
import path from "node:path";
import { isPrivateEntry } from "./isPrivateEntry";
import { loginDirFor } from "./loginDirFor";
import { sharedPathOf } from "./sharedPathOf";

/** Something to bring home: where it is, where it belongs, and where it goes if that place is taken. */
type Move = [entry: string, home: string, parked: string];

/**
 * Claude Code recreates a deleted config folder as a plain one, so a real entry where a link belongs is history or
 * settings that would be stranded there. It moves to the shared folder. A transcript the shared folder already has
 * gets the lines it is missing. Any other file it already has is parked under `removed/<id>` instead of overwriting it. Resolves `false` when something could not be moved yet,
 * such as a file Windows holds open.
 */
export async function salvageLoginDir(storeDir: string, id: string): Promise<boolean> {
	const dir = loginDirFor(storeDir, id);
	const parked = path.join(storeDir, "removed", id, new Date().toISOString().replace(/[:.]/g, "-"));
	const moves: Move[] = [];
	for (const name of await fs.readdir(dir).catch(() => [])) {
		// Links at the top are the folder's own. Below a real folder, a link is something Claude Code made.
		if (!isPrivateEntry(name) && !(await isLink(path.join(dir, name)))) {
			moves.push([path.join(dir, name), sharedPathOf(name), path.join(parked, name)]);
		}
	}

	return bringAllHome(moves);
}

async function bringAllHome(moves: Move[]): Promise<boolean> {
	let clean = true;
	for (const [entry, home, parked] of moves) {
		clean = (await bringHome(entry, home, parked)) && clean;
	}

	return clean;
}

async function bringHome(entry: string, home: string, parked: string): Promise<boolean> {
	try {
		const stats = await fs.lstat(entry);
		const existing = await fs.stat(home).catch(() => null);
		if (!existing) {
			await move(entry, home);
			return true;
		}

		if (stats.isFile() && existing.isFile() && entry.endsWith(".jsonl")) {
			await mergeTranscript(entry, home);
			return true;
		}

		if (!stats.isDirectory() || !existing.isDirectory()) {
			await move(entry, parked);
			return true;
		}

		const names = await fs.readdir(entry);
		const clean = await bringAllHome(names.map((name) => [path.join(entry, name), path.join(home, name), path.join(parked, name)]));
		if (clean) {
			await fs.rmdir(entry);
		}

		return clean;
	} catch {
		return false;
	}
}

/** An entry that vanished since the folder was listed counts as one, since there is nothing left to move. */
async function isLink(entry: string): Promise<boolean> {
	return fs.lstat(entry).then(
		(stats) => stats.isSymbolicLink(),
		() => true
	);
}

/**
 * A session that kept running after its folder lost its links writes its next lines there. Appending, rather than
 * rewriting, can't lose a line Claude Code appends to the shared copy meanwhile.
 */
async function mergeTranscript(entry: string, home: string): Promise<void> {
	const existing = await fs.readFile(home, "utf8");
	const known = new Set(existing.split("\n"));
	const missing = (await fs.readFile(entry, "utf8")).split("\n").filter((line) => line && !known.has(line));
	if (missing.length > 0) {
		await fs.appendFile(home, `${existing && !existing.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
	}

	await fs.unlink(entry);
}

async function move(from: string, to: string): Promise<void> {
	await fs.mkdir(path.dirname(to), { recursive: true });
	await fs.rename(from, to);
}
