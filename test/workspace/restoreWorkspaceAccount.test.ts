import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { pickedAtKey } from "../../src/workspace/pickedAtKey";
import { rememberWorkspaceAccount } from "../../src/workspace/rememberWorkspaceAccount";
import { restoreWorkspaceAccount } from "../../src/workspace/restoreWorkspaceAccount";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { useSettings } from "../helpers/useSettings";
import { workspaceMemory } from "../helpers/workspaceMemory";

vi.mock("../../src/workspace/rememberWorkspaceAccount");
vi.mock("../../src/workspace/useWorkspaceAccount");

describe("restoreWorkspaceAccount", () => {
	beforeEach(() => {
		vi.mocked(useWorkspaceAccount).mockResolvedValue();
	});

	it("returns the window to the account its workspace last used", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		const memory = workspaceMemory(loginDirFor(store.dir, work.id));
		await restoreWorkspaceAccount(memory, store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		expect(rememberWorkspaceAccount).toHaveBeenCalledWith(memory);
	});

	it("points the window at its account before the first await, so Claude Code starting alongside reads that login", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setActive(personal.id);
		const dir = loginDirFor(store.dir, work.id);
		fs.mkdirSync(dir, { recursive: true });
		const restoring = restoreWorkspaceAccount(workspaceMemory(dir), store);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe(dir);
		await restoring;
	});

	it("leaves pointing at a missing login folder to the full restore, which rebuilds or drops it", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const restoring = restoreWorkspaceAccount(workspaceMemory(loginDirFor(store.dir, "gone-id")), store);
		expect(process.env.CLAUDE_CONFIG_DIR).toBeUndefined();
		await restoring;
	});

	it.each([
		["the scope is global", "global", true],
		["the account has been removed", "workspace", false]
	])("follows the shared login when %s", async (_case, switchScope, saved) => {
		useSettings({ switchScope });
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await restoreWorkspaceAccount(workspaceMemory(loginDirFor(store.dir, saved ? work.id : "gone-id")), store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, undefined);
	});

	it.each([
		["an account that is no longer saved", "gone-id"],
		["the account the shared login belongs to", "shared"]
	])("never points the window at the folder of %s, even when it is still there", async (_case, pin) => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		const dir = loginDirFor(store.dir, pin === "shared" ? personal.id : pin);
		fs.mkdirSync(dir, { recursive: true });
		const restoring = restoreWorkspaceAccount(workspaceMemory(dir), store);
		expect(process.env.CLAUDE_CONFIG_DIR).toBeUndefined();
		await restoring;
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, pin === "shared" ? personal.id : undefined);
	});

	it("moves a workspace that picked before another window signed an account in everywhere to that account", async () => {
		vi.spyOn(Date, "now").mockReturnValue(9000);
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setActive(personal.id);
		const workDir = loginDirFor(store.dir, work.id);
		fs.mkdirSync(workDir, { recursive: true });
		vi.mocked(Date.now).mockReturnValue(10_000);
		await store.setEverywhere(work.id);
		const memory = workspaceMemory(loginDirFor(store.dir, personal.id), 9000);
		const restoring = restoreWorkspaceAccount(memory, store);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe(workDir);
		await restoring;
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		expect(memory.state.get(pickedAtKey)).toBe(10_000);
	});

	it("keeps a pick made since then, and ignores the note while one account applies everywhere anyway", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setEverywhere(personal.id);
		const at = store.snapshot().everywhere!.at;
		await restoreWorkspaceAccount(workspaceMemory(loginDirFor(store.dir, work.id), at), store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		useSettings({});
		await restoreWorkspaceAccount(workspaceMemory(), store);
		expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, undefined);
	});

	it("follows the shared login in a workspace that never picked an account", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		await restoreWorkspaceAccount(workspaceMemory(), store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, undefined);
	});

	it("still updates the terminal environment when the account cannot be restored", async () => {
		const memory = workspaceMemory();
		vi.mocked(useWorkspaceAccount).mockRejectedValue(new Error("Windows blocked the links"));
		await expect(restoreWorkspaceAccount(memory, createTempStore())).rejects.toThrow("Windows blocked the links");
		expect(rememberWorkspaceAccount).toHaveBeenCalledWith(memory);
	});
});
