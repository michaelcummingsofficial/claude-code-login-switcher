import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { useSettings } from "../helpers/useSettings";

let root: string;
let base: string;
let storeDir: string;

function write(file: string, contents: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, contents);
}

describe("ensureLoginDir", () => {
	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-login-"));
		onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
		base = path.join(root, "config");
		storeDir = path.join(root, "store");
		useSettings({ claudeConfigDir: base });
	});

	it("links the shared files and folders into a folder named after the account", async () => {
		write(path.join(base, "settings.json"), "{}");
		write(path.join(base, "projects", "repo", "session.jsonl"), "history");
		const dir = await ensureLoginDir(storeDir, "work-id");
		expect(dir).toBe(path.join(storeDir, "logins", "work-id"));
		expect(fs.lstatSync(path.join(dir, "settings.json")).isSymbolicLink()).toBe(true);
		expect(fs.readFileSync(path.join(dir, "projects", "repo", "session.jsonl"), "utf8")).toBe("history");
		fs.writeFileSync(path.join(dir, "settings.json"), '{"theme":"dark"}');
		expect(fs.readFileSync(path.join(base, "settings.json"), "utf8")).toBe('{"theme":"dark"}');
	});

	it("keeps the login and lock folders out, so each account signs in on its own", async () => {
		write(path.join(base, ".credentials.json"), "shared-login");
		write(path.join(base, ".claude.json.lock", "held"), "");
		const dir = await ensureLoginDir(storeDir, "work-id");
		expect(fs.readdirSync(dir)).toEqual([]);
	});

	it("links the global config inside the folder when Claude Code's folder is configured", async () => {
		write(path.join(base, ".claude.json"), '{"mcpServers":{}}');
		const dir = await ensureLoginDir(storeDir, "work-id");
		expect(fs.readFileSync(path.join(dir, ".claude.json"), "utf8")).toBe('{"mcpServers":{}}');
	});

	it("picks up what the shared folder gained since the last run and leaves existing links alone", async () => {
		write(path.join(base, "settings.json"), "{}");
		await ensureLoginDir(storeDir, "work-id");
		write(path.join(base, "CLAUDE.md"), "notes");
		const dir = await ensureLoginDir(storeDir, "work-id");
		expect(fs.readdirSync(dir).sort()).toEqual(["CLAUDE.md", "settings.json"]);
		expect(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe("notes");
	});

	it("moves what Claude Code created in the login folder into the shared one, keeping the login", async () => {
		const dir = await ensureLoginDir(storeDir, "work-id");
		write(path.join(dir, "history.jsonl"), "prompts");
		write(path.join(dir, ".credentials.json"), "work-login");
		await ensureLoginDir(storeDir, "work-id");
		expect(fs.readFileSync(path.join(base, "history.jsonl"), "utf8")).toBe("prompts");
		expect(fs.lstatSync(path.join(dir, "history.jsonl")).isSymbolicLink()).toBe(true);
		expect(fs.existsSync(path.join(base, ".credentials.json"))).toBe(false);
		expect(fs.lstatSync(path.join(dir, ".credentials.json")).isSymbolicLink()).toBe(false);
	});

	it("leaves a link alone once its shared file is gone", async () => {
		write(path.join(base, "settings.json"), "{}");
		const dir = await ensureLoginDir(storeDir, "work-id");
		fs.rmSync(path.join(base, "settings.json"));
		await ensureLoginDir(storeDir, "work-id");
		expect(fs.readdirSync(base)).toEqual([]);
		expect(fs.lstatSync(path.join(dir, "settings.json")).isSymbolicLink()).toBe(true);
	});

	it("leaves a new file where it is when it cannot be moved yet", async () => {
		const dir = await ensureLoginDir(storeDir, "work-id");
		write(path.join(dir, "history.jsonl"), "prompts");
		vi.spyOn(fs.promises, "rename").mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));
		await ensureLoginDir(storeDir, "work-id");
		expect(fs.lstatSync(path.join(dir, "history.jsonl")).isSymbolicLink()).toBe(false);
		expect(fs.existsSync(path.join(base, "history.jsonl"))).toBe(false);
	});

	describe("with Claude Code's default folder", () => {
		let home: string;

		beforeEach(() => {
			home = path.join(root, "home");
			fs.mkdirSync(home);
			vi.spyOn(os, "homedir").mockReturnValue(home);
			useSettings({});
		});

		it("links ~/.claude and the global config beside it", async () => {
			write(path.join(home, ".claude", "settings.json"), "{}");
			write(path.join(home, ".claude.json"), '{"mcpServers":{}}');
			const dir = await ensureLoginDir(storeDir, "work-id");
			expect(fs.readFileSync(path.join(dir, "settings.json"), "utf8")).toBe("{}");
			expect(fs.readFileSync(path.join(dir, ".claude.json"), "utf8")).toBe('{"mcpServers":{}}');
		});

		it("works before Claude Code has created either", async () => {
			const dir = await ensureLoginDir(storeDir, "work-id");
			expect(fs.readdirSync(dir)).toEqual([".claude.json"]);
		});
	});

	it("explains how to allow links when Windows blocks them", async () => {
		write(path.join(base, "settings.json"), "{}");
		vi.spyOn(fs.promises, "symlink").mockRejectedValue(Object.assign(new Error("operation not permitted"), { code: "EPERM" }));
		await expect(ensureLoginDir(storeDir, "work-id")).rejects.toThrow(
			"Windows blocked the links a workspace account needs. Turn on Developer Mode in Windows Settings, then switch again."
		);
	});

	it("passes any other link failure on", async () => {
		write(path.join(base, "settings.json"), "{}");
		vi.spyOn(fs.promises, "symlink").mockRejectedValue(Object.assign(new Error("disk full"), { code: "ENOSPC" }));
		await expect(ensureLoginDir(storeDir, "work-id")).rejects.toThrow("disk full");
	});
});
