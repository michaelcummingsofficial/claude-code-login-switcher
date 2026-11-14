import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { salvageLoginDir } from "../../src/workspace/salvageLoginDir";
import { useSettings } from "../helpers/useSettings";

let base: string;
let storeDir: string;
let dir: string;

function write(file: string, contents: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, contents);
}

/** Every file under `root`, relative to it, with its contents. */
function filesIn(root: string): Record<string, string> {
	const files: Record<string, string> = {};
	for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
		if (entry.isFile()) {
			const file = path.join(entry.parentPath, entry.name);
			files[path.relative(root, file)] = fs.readFileSync(file, "utf8");
		}
	}

	return files;
}

describe("salvageLoginDir", () => {
	beforeEach(() => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-salvage-"));
		onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
		base = path.join(root, "config");
		storeDir = path.join(root, "store");
		dir = loginDirFor(storeDir, "work-id");
		fs.mkdirSync(dir, { recursive: true });
		useSettings({ claudeConfigDir: base });
	});

	it("moves what a recreated folder gathered into the shared one", async () => {
		write(path.join(dir, "history.jsonl"), "prompts");
		write(path.join(dir, "projects", "repo", "session.jsonl"), "transcript");
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
		expect(filesIn(base)).toEqual({ "history.jsonl": "prompts", [path.join("projects", "repo", "session.jsonl")]: "transcript" });
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	it("merges folders that exist on both sides, one level at a time", async () => {
		write(path.join(base, "projects", "repo", "old.jsonl"), "old");
		write(path.join(dir, "projects", "repo", "new.jsonl"), "new");
		write(path.join(dir, "projects", "other", "side.jsonl"), "side");
		await salvageLoginDir(storeDir, "work-id");
		expect(filesIn(path.join(base, "projects"))).toEqual({
			[path.join("repo", "old.jsonl")]: "old",
			[path.join("repo", "new.jsonl")]: "new",
			[path.join("other", "side.jsonl")]: "side"
		});
		expect(fs.existsSync(path.join(dir, "projects"))).toBe(false);
	});

	it("parks a file the shared folder already has instead of overwriting it", async () => {
		vi.useFakeTimers({ now: new Date("2026-11-13T08:39:00.000Z"), toFake: ["Date"] });
		onTestFinished(() => void vi.useRealTimers());
		write(path.join(base, ".claude.json"), "shared-config");
		write(path.join(dir, ".claude.json"), "forked-config");
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
		expect(filesIn(base)).toEqual({ ".claude.json": "shared-config" });
		expect(filesIn(path.join(storeDir, "removed", "work-id", "2026-11-13T08-39-00-000Z"))).toEqual({ ".claude.json": "forked-config" });
	});

	it("gives a transcript in both places the lines it is missing, in the shared copy", async () => {
		const session = path.join("projects", "repo", "session.jsonl");
		write(path.join(base, session), '{"n":1}\n{"n":2}\n');
		write(path.join(dir, session), '{"n":2}\n{"n":3}\n');
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
		expect(filesIn(base)).toEqual({ [session]: '{"n":1}\n{"n":2}\n{"n":3}\n' });
		expect(fs.existsSync(path.join(dir, "projects"))).toBe(false);
		expect(fs.existsSync(path.join(storeDir, "removed"))).toBe(false);
	});

	it("starts the missing lines on a line of their own, and drops a stray copy with nothing new", async () => {
		write(path.join(base, "a.jsonl"), '{"n":1}');
		write(path.join(dir, "a.jsonl"), '{"n":2}\n');
		write(path.join(base, "b.jsonl"), '{"n":1}\n');
		write(path.join(dir, "b.jsonl"), '{"n":1}\n');
		await salvageLoginDir(storeDir, "work-id");
		expect(filesIn(base)).toEqual({ "a.jsonl": '{"n":1}\n{"n":2}\n', "b.jsonl": '{"n":1}\n' });
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	it("parks a folder where the shared side has a file of the same name", async () => {
		write(path.join(base, "todos"), "a file");
		write(path.join(dir, "todos", "list.json"), "[]");
		await salvageLoginDir(storeDir, "work-id");
		expect(fs.readFileSync(path.join(base, "todos"), "utf8")).toBe("a file");
		expect(fs.readdirSync(path.join(storeDir, "removed", "work-id"))).toHaveLength(1);
	});

	it.skipIf(process.platform === "win32")("moves a link Claude Code made inside a real folder, and leaves the folder's own links", async () => {
		write(path.join(base, "settings.json"), "{}");
		fs.symlinkSync(path.join(base, "settings.json"), path.join(dir, "settings.json"));
		fs.mkdirSync(path.join(dir, "plugins"));
		fs.symlinkSync("/elsewhere", path.join(dir, "plugins", "current"));
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
		expect(fs.lstatSync(path.join(dir, "settings.json")).isSymbolicLink()).toBe(true);
		expect(fs.readlinkSync(path.join(base, "plugins", "current"))).toBe("/elsewhere");
	});

	it("leaves the login and lock folders where they are", async () => {
		write(path.join(dir, ".credentials.json"), "work-login");
		write(path.join(dir, ".claude.json.lock", "held"), "");
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
		expect(fs.readdirSync(dir).sort()).toEqual([".claude.json.lock", ".credentials.json"]);
		expect(fs.existsSync(base)).toBe(false);
	});

	it("moves the global config beside ~/.claude when Claude Code uses its default folder", async () => {
		const home = path.join(storeDir, "..", "home");
		vi.spyOn(os, "homedir").mockReturnValue(home);
		useSettings({});
		write(path.join(dir, ".claude.json"), "config");
		await salvageLoginDir(storeDir, "work-id");
		expect(fs.readFileSync(path.join(home, ".claude.json"), "utf8")).toBe("config");
	});

	it("reports a folder it could not empty, and keeps what it could not move", async () => {
		write(path.join(dir, "history.jsonl"), "prompts");
		write(path.join(dir, "projects", "repo", "session.jsonl"), "transcript");
		fs.mkdirSync(path.join(base, "projects"), { recursive: true });
		vi.spyOn(fs.promises, "rename").mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(false);
		expect(filesIn(dir)).toEqual({ "history.jsonl": "prompts", [path.join("projects", "repo", "session.jsonl")]: "transcript" });
	});

	it("skips an entry that disappears while the folder is read", async () => {
		write(path.join(dir, "history.jsonl"), "prompts");
		const lstat = fs.promises.lstat;
		vi.spyOn(fs.promises, "lstat").mockImplementation(async (entry, options) => {
			if (String(entry).endsWith("history.jsonl")) {
				throw Object.assign(new Error("gone"), { code: "ENOENT" });
			}

			return lstat(entry, options);
		});
		await expect(salvageLoginDir(storeDir, "work-id")).resolves.toBe(true);
	});

	it("has nothing to do for a folder that does not exist", async () => {
		await expect(salvageLoginDir(storeDir, "gone-id")).resolves.toBe(true);
	});
});
