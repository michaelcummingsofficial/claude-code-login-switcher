import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentVariableCollection } from "vscode";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { rememberWorkspaceAccount } from "../../src/workspace/rememberWorkspaceAccount";
import { restoreWorkspaceAccount } from "../../src/workspace/restoreWorkspaceAccount";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { useSettings } from "../helpers/useSettings";

vi.mock("../../src/workspace/rememberWorkspaceAccount");
vi.mock("../../src/workspace/useWorkspaceAccount");

function remembering(dir?: string): EnvironmentVariableCollection {
	return { get: () => (dir ? { value: dir } : undefined) } as unknown as EnvironmentVariableCollection;
}

describe("restoreWorkspaceAccount", () => {
	beforeEach(() => {
		vi.mocked(useWorkspaceAccount).mockResolvedValue();
	});

	it("returns the window to the account its workspace last used", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		const environment = remembering(loginDirFor(store.dir, work.id));
		await restoreWorkspaceAccount(environment, store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		expect(rememberWorkspaceAccount).toHaveBeenCalledWith(environment);
	});

	it.each([
		["the scope is global", "global", true],
		["the account has been removed", "workspace", false]
	])("follows the shared login when %s", async (_case, switchScope, saved) => {
		useSettings({ switchScope });
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await restoreWorkspaceAccount(remembering(loginDirFor(store.dir, saved ? work.id : "gone-id")), store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, undefined);
	});

	it("follows the shared login in a workspace that never picked an account", async () => {
		useSettings({ switchScope: "workspace" });
		const store = createTempStore();
		await restoreWorkspaceAccount(remembering(), store);
		expect(useWorkspaceAccount).toHaveBeenCalledWith(store, undefined);
	});

	it("still updates the terminal environment when the account cannot be restored", async () => {
		const environment = remembering();
		vi.mocked(useWorkspaceAccount).mockRejectedValue(new Error("Windows blocked the links"));
		await expect(restoreWorkspaceAccount(environment, createTempStore())).rejects.toThrow("Windows blocked the links");
		expect(rememberWorkspaceAccount).toHaveBeenCalledWith(environment);
	});
});
