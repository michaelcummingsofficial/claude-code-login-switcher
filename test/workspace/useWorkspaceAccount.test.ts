import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import type { Profile, ProfileStore } from "../../src/profiles/ProfileStore";
import { getSettings } from "../../src/settings/getSettings";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";

vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/ensureLoginDir");

const login = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { accessToken: `token-${expiresAt}`, expiresAt } });

let live: FakeLiveCredential;

/** A store whose shared login belongs to "Personal", so the accounts a test adds with `addElsewhere` get folders. */
async function storeSharedWithPersonal(): Promise<ProfileStore> {
	const store = createTempStore();
	await store.add({ label: "Personal" }, "personal-tokens");
	return store;
}

/** Saves an account without handing it the shared login, the way a login made in a workspace is saved. */
async function addElsewhere(store: ProfileStore, label: string, credentials: string): Promise<Profile> {
	const shared = await store.sharedId();
	const profile = await store.add({ label }, credentials);
	await store.setActive(shared);
	return profile;
}

describe("useWorkspaceAccount", () => {
	beforeEach(() => {
		live = useLiveCredential(null);
		vi.mocked(ensureLoginDir).mockImplementation(async (storeDir, id) => loginDirFor(storeDir, id));
	});

	it("points this window at the account's folder and signs it in with the saved login", async () => {
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", "work-tokens");
		await useWorkspaceAccount(store, work.id);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe(loginDirFor(store.dir, work.id));
		expect(getSettings().workspaceAccountId).toBe(work.id);
		expect(live.value).toBe("work-tokens");
	});

	it("keeps a login another window has refreshed since the account was saved", async () => {
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", login(1000));
		live.value = login(2000);
		await useWorkspaceAccount(store, work.id);
		expect(live.value).toBe(login(2000));
	});

	it("replaces a login that the saved copy has outlived", async () => {
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", login(2000));
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
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", "work-tokens");
		await useWorkspaceAccount(store, work.id);
		await useWorkspaceAccount(store, undefined);
		expect(process.env.CLAUDE_CONFIG_DIR).toBeUndefined();
		expect(getSettings().workspaceAccountId).toBeUndefined();
	});

	it("stays on the shared login when the account cannot be signed in", async () => {
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", "work-tokens");
		vi.spyOn(live, "write").mockRejectedValue(new Error("security failed (1)"));
		await expect(useWorkspaceAccount(store, work.id)).rejects.toThrow("security failed (1)");
		expect(getSettings().workspaceAccountId).toBeUndefined();
	});

	it("stays on the previous workspace account when the next one cannot be signed in", async () => {
		const store = await storeSharedWithPersonal();
		const work = await addElsewhere(store, "Work", "work-tokens");
		await useWorkspaceAccount(store, work.id);
		const studio = await addElsewhere(store, "Studio", login(2000));
		live.value = login(1000);
		vi.spyOn(live, "write").mockRejectedValue(new Error("security failed (1)"));
		await expect(useWorkspaceAccount(store, studio.id)).rejects.toThrow("security failed (1)");
		expect(getSettings().workspaceAccountId).toBe(work.id);
	});

	describe("for the account the shared login belongs to", () => {
		let folder: FakeLiveCredential;

		/** Gives the shared account a login folder of its own, holding `folderLogin`, as an older version made one. */
		async function storeWithSharedFolder(folderLogin: string | null): Promise<{ store: ProfileStore; id: string }> {
			const store = createTempStore();
			const personal = await store.add({ label: "Personal" }, login(2000));
			fs.mkdirSync(loginDirFor(store.dir, personal.id), { recursive: true });
			folder = { location: "the folder's login", value: folderLogin, read: async () => folder.value, write: vi.fn() };
			vi.mocked(resolveLiveCredential).mockImplementation(async (configDir) => (configDir ? folder : live));
			return { store, id: personal.id };
		}

		it("follows the shared login instead of making a folder, so the account lives in one place", async () => {
			const store = createTempStore();
			const personal = await store.add({ label: "Personal" }, "personal-tokens");
			const work = await addElsewhere(store, "Work", "work-tokens");
			redirectConfigDir(loginDirFor(store.dir, work.id));
			live.value = "personal-tokens";
			await useWorkspaceAccount(store, personal.id);
			expect(getSettings().workspaceAccountId).toBeUndefined();
			expect(ensureLoginDir).not.toHaveBeenCalled();
		});

		it("puts a login just renewed for the account into the shared login right away", async () => {
			const store = createTempStore();
			const personal = await store.add({ label: "Personal" }, login(3000));
			live.value = login(1000);
			await useWorkspaceAccount(store, personal.id);
			expect(live.value).toBe(login(3000));
		});

		it("leaves a shared login that refreshed after the saved copy", async () => {
			const store = createTempStore();
			const personal = await store.add({ label: "Personal" }, login(1000));
			live.value = login(3000);
			await useWorkspaceAccount(store, personal.id);
			expect(live.value).toBe(login(3000));
		});

		it("moves the newest copy into the shared login when the folder refreshed last, and keeps the folder", async () => {
			const { store, id } = await storeWithSharedFolder(login(3000));
			live.value = login(1000);
			await useWorkspaceAccount(store, id);
			expect(live.value).toBe(login(3000));
			expect(fs.existsSync(loginDirFor(store.dir, id))).toBe(true);
		});

		it("takes the saved copy when it is newer than both logins", async () => {
			const { store, id } = await storeWithSharedFolder(login(1500));
			live.value = login(1000);
			await useWorkspaceAccount(store, id);
			expect(live.value).toBe(login(2000));
		});

		it("keeps the shared login when it refreshed last", async () => {
			const { store, id } = await storeWithSharedFolder(login(1500));
			live.value = login(4000);
			const write = vi.spyOn(live, "write");
			await useWorkspaceAccount(store, id);
			expect(write).not.toHaveBeenCalled();
			expect(fs.existsSync(loginDirFor(store.dir, id))).toBe(true);
		});

		it("signs the shared login in from the folder when it has none", async () => {
			const { store, id } = await storeWithSharedFolder(null);
			await useWorkspaceAccount(store, id);
			expect(live.value).toBe(login(2000));
		});

		it("leaves everything as it is when there is no login anywhere to carry over", async () => {
			const { store, id } = await storeWithSharedFolder(null);
			vi.spyOn(store, "credentialsFor").mockResolvedValue(null);
			const write = vi.spyOn(live, "write");
			await useWorkspaceAccount(store, id);
			expect(write).not.toHaveBeenCalled();
			expect(fs.existsSync(loginDirFor(store.dir, id))).toBe(true);
		});
	});
});
