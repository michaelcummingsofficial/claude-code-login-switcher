import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { newestLoginOf } from "../../src/workspace/newestLoginOf";
import { createTempStore } from "../helpers/createTempStore";

vi.mock("../../src/credentials/resolveLiveCredential");

const login = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { accessToken: `token-${expiresAt}`, expiresAt } });

let folderLogin: string | null;

describe("newestLoginOf", () => {
	beforeEach(() => {
		folderLogin = null;
		vi.mocked(resolveLiveCredential).mockImplementation(async () => ({ location: "folder", read: async () => folderLogin, write: vi.fn() }));
	});

	it("picks whichever of the saved copy, the folder's login, and the one given refreshed last", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, login(2000));
		fs.mkdirSync(loginDirFor(store.dir, work.id), { recursive: true });
		folderLogin = login(3000);
		await expect(newestLoginOf(store, work.id, login(1000))).resolves.toBe(login(3000));
		await expect(newestLoginOf(store, work.id, login(4000))).resolves.toBe(login(4000));
		expect(resolveLiveCredential).toHaveBeenCalledWith(loginDirFor(store.dir, work.id));
	});

	it("uses the saved copy alone for an account without a folder", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, login(2000));
		await expect(newestLoginOf(store, work.id)).resolves.toBe(login(2000));
		expect(resolveLiveCredential).not.toHaveBeenCalled();
	});

	it("is null when there is no copy anywhere", async () => {
		await expect(newestLoginOf(createTempStore(), "gone-id")).resolves.toBeNull();
	});
});
