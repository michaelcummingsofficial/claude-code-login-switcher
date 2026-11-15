import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { healLoginDirs } from "../../src/workspace/healLoginDirs";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { createTempStore } from "../helpers/createTempStore";

vi.mock("../../src/workspace/ensureLoginDir");

describe("healLoginDirs", () => {
	it("relinks every login folder, saved or not, and removes none", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		for (const id of [work.id, "removed-id"]) {
			fs.mkdirSync(loginDirFor(store.dir, id), { recursive: true });
		}

		fs.writeFileSync(path.join(store.dir, "logins", ".DS_Store"), "");
		await healLoginDirs(store);
		expect(
			vi
				.mocked(ensureLoginDir)
				.mock.calls.map(([, id]) => id)
				.sort()
		).toEqual([work.id, "removed-id"].sort());
		expect(fs.readdirSync(path.join(store.dir, "logins")).sort()).toEqual([".DS_Store", work.id, "removed-id"].sort());
	});

	it("leaves Claude Code's refresh lock beside a login folder out of the relinking", async () => {
		const store = createTempStore();
		fs.mkdirSync(`${loginDirFor(store.dir, "work-id")}.lock`, { recursive: true });
		await healLoginDirs(store);
		expect(ensureLoginDir).not.toHaveBeenCalled();
	});

	it.skipIf(process.platform === "win32")("takes the links back out of a refresh lock, so Claude Code can release it", async () => {
		const store = createTempStore();
		const lock = `${loginDirFor(store.dir, "work-id")}.lock`;
		fs.mkdirSync(path.join(lock, "plans"), { recursive: true });
		fs.symlinkSync("/shared/projects", path.join(lock, "projects"));
		fs.writeFileSync(path.join(lock, "settings.json"), "{}");
		const stale = new Date(Date.now() - 3_600_000);
		fs.utimesSync(lock, stale, stale);
		await healLoginDirs(store);
		expect(fs.readdirSync(lock).sort()).toEqual(["plans", "settings.json"]);
		expect(fs.statSync(lock).mtimeMs).toBe(stale.getTime());
	});

	it("leaves a lock Claude Code holds untouched", async () => {
		const store = createTempStore();
		const lock = `${loginDirFor(store.dir, "work-id")}.lock`;
		fs.mkdirSync(lock, { recursive: true });
		const held = new Date(Date.now() - 1000);
		fs.utimesSync(lock, held, held);
		await healLoginDirs(store);
		expect(fs.statSync(lock).mtimeMs).toBe(held.getTime());
	});

	it("does nothing before any workspace has its own login", async () => {
		await healLoginDirs(createTempStore());
		expect(ensureLoginDir).not.toHaveBeenCalled();
	});
});
