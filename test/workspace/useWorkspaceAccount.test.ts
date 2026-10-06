import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings } from "../../src/settings/getSettings";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";

vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/ensureLoginDir");

const login = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { accessToken: `token-${expiresAt}`, expiresAt } });

let live: FakeLiveCredential;

describe("useWorkspaceAccount", () => {
	beforeEach(() => {
		live = useLiveCredential(null);
		vi.mocked(ensureLoginDir).mockImplementation(async (storeDir, id) => loginDirFor(storeDir, id));
	});

	it("points this window at the account's folder and signs it in with the saved login", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await useWorkspaceAccount(store, work.id);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe(loginDirFor(store.dir, work.id));
		expect(getSettings().workspaceAccountId).toBe(work.id);
		expect(live.value).toBe("work-tokens");
	});

	it("keeps a login another window has refreshed since the account was saved", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, login(1000));
		live.value = login(2000);
		await useWorkspaceAccount(store, work.id);
		expect(live.value).toBe(login(2000));
	});

	it("replaces a login that the saved copy has outlived", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, login(2000));
		live.value = login(1000);
		await useWorkspaceAccount(store, work.id);
		expect(live.value).toBe(login(2000));
	});

	it("leaves the folder signed out when nothing is saved under that id yet", async () => {
		const store = createTempStore();
		const write = vi.spyOn(live, "write");
		await useWorkspaceAccount(store, "new-id");
		expect(getSettings().workspaceAccountId).toBe("new-id");
		expect(write).not.toHaveBeenCalled();
	});

	it("goes back to the shared login", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await useWorkspaceAccount(store, work.id);
		await useWorkspaceAccount(store, undefined);
		expect(process.env.CLAUDE_CONFIG_DIR).toBeUndefined();
		expect(getSettings().workspaceAccountId).toBeUndefined();
	});

	it("stays on the shared login when the account cannot be signed in", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		vi.spyOn(live, "write").mockRejectedValue(new Error("security failed (1)"));
		await expect(useWorkspaceAccount(store, work.id)).rejects.toThrow("security failed (1)");
		expect(getSettings().workspaceAccountId).toBeUndefined();
	});

	it("stays on the previous workspace account when the next one cannot be signed in", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await useWorkspaceAccount(store, work.id);
		const personal = await store.add({ label: "Personal" }, login(2000));
		live.value = login(1000);
		vi.spyOn(live, "write").mockRejectedValue(new Error("security failed (1)"));
		await expect(useWorkspaceAccount(store, personal.id)).rejects.toThrow("security failed (1)");
		expect(getSettings().workspaceAccountId).toBe(work.id);
	});
});
