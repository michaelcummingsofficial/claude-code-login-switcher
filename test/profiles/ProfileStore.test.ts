import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ProfileStore } from "../../src/profiles/ProfileStore";
import { createTempStore } from "../helpers/createTempStore";
import { memoryVault } from "../helpers/memoryVault";

const TOKENS = '{"claudeAiOauth":{"accessToken":"sk-ant-oat01-abc","refreshToken":"sk-ant-ort01-def"}}';

describe("ProfileStore", () => {
	it("starts empty when there is no file", async () => {
		const store = createTempStore();
		await expect(store.list()).resolves.toEqual([]);
		await expect(store.activeId()).resolves.toBeNull();
		await expect(store.active()).resolves.toBeNull();
	});

	it.each([
		["invalid JSON", "{not json"],
		["JSON null", "null"],
		["wrong shapes", '{"activeId":5,"profiles":"nope"}']
	])("starts empty from %s", async (_case, contents) => {
		const store = createTempStore();
		fs.mkdirSync(store.dir, { recursive: true });
		fs.writeFileSync(store.path, contents);
		await expect(store.list()).resolves.toEqual([]);
		await expect(store.activeId()).resolves.toBeNull();
	});

	it("adds a profile, keeps its tokens in the vault only, and makes it active", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		const vault = memoryVault();
		const store = createTempStore(vault);
		const saved = await store.add({ label: "Work", email: "ada@work.com", refreshTokenExpiresAt: 1_800_000_000_000 }, TOKENS);
		expect(saved).toEqual({
			id: expect.stringMatching(/^[0-9a-f-]{36}$/),
			label: "Work",
			email: "ada@work.com",
			refreshTokenExpiresAt: 1_800_000_000_000,
			savedAt: 1_700_000_000_000
		});
		expect(vault.items.get(saved.id)).toBe(TOKENS);
		await expect(store.active()).resolves.toEqual(saved);
		await expect(store.credentialsFor(saved.id)).resolves.toBe(TOKENS);
		const file = fs.readFileSync(store.path, "utf8");
		expect(file).not.toContain("sk-ant");
		expect(JSON.parse(file)).toEqual({ version: 1, activeId: saved.id, profiles: [saved] });
	});

	it.skipIf(process.platform === "win32")("creates the folder and file readable by the owner only", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, TOKENS);
		expect(fs.statSync(store.dir).mode & 0o777).toBe(0o700);
		expect(fs.statSync(store.path).mode & 0o777).toBe(0o600);
		expect(fs.readdirSync(store.dir)).toEqual(["profiles.json"]);
	});

	it("updates fields and credentials, and bumps savedAt", async () => {
		const store = createTempStore();
		const saved = await store.add({ label: "Work" }, TOKENS);
		vi.spyOn(Date, "now").mockReturnValue(saved.savedAt + 1000);
		await store.update(saved.id, { label: "Work (Max)", subscriptionType: "max" }, "rotated");
		await expect(store.list()).resolves.toEqual([{ ...saved, label: "Work (Max)", subscriptionType: "max", savedAt: saved.savedAt + 1000 }]);
		await expect(store.credentialsFor(saved.id)).resolves.toBe("rotated");
	});

	it("leaves credentials alone when an update has none", async () => {
		const store = createTempStore();
		const saved = await store.add({ label: "Work" }, TOKENS);
		await store.update(saved.id, { label: "Renamed" });
		await expect(store.credentialsFor(saved.id)).resolves.toBe(TOKENS);
	});

	it("ignores an update for an unknown id without writing a stray secret", async () => {
		const vault = memoryVault();
		const store = createTempStore(vault);
		const saved = await store.add({ label: "Work" }, TOKENS);
		const before = fs.readFileSync(store.path, "utf8");
		await store.update("missing", { label: "Ghost" }, TOKENS);
		expect(fs.readFileSync(store.path, "utf8")).toBe(before);
		expect([...vault.items.keys()]).toEqual([saved.id]);
	});

	it("reads a missing secret as null", async () => {
		await expect(createTempStore().credentialsFor("missing")).resolves.toBeNull();
	});

	it("sets and clears the active profile", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, TOKENS);
		await store.add({ label: "Personal" }, "personal");
		await store.setActive(work.id);
		await expect(store.active()).resolves.toMatchObject({ label: "Work" });
		await store.setActive(null);
		await expect(store.active()).resolves.toBeNull();
	});

	it("removes the active profile and its tokens, clearing activeId", async () => {
		const vault = memoryVault();
		const store = createTempStore(vault);
		const saved = await store.add({ label: "Work" }, TOKENS);
		await store.remove(saved.id);
		await expect(store.list()).resolves.toEqual([]);
		await expect(store.activeId()).resolves.toBeNull();
		expect(vault.items.size).toBe(0);
	});

	it("keeps activeId when removing a different profile", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, TOKENS);
		const personal = await store.add({ label: "Personal" }, "personal");
		await store.remove(work.id);
		await expect(store.activeId()).resolves.toBe(personal.id);
		await expect(store.list()).resolves.toEqual([personal]);
	});

	it("sees writes from another window's store immediately", async () => {
		const vault = memoryVault();
		const windowA = createTempStore(vault);
		const windowB = new ProfileStore(windowA.dir, vault);
		const work = await windowA.add({ label: "Work" }, TOKENS);
		await expect(windowB.activeId()).resolves.toBe(work.id);
		const personal = await windowB.add({ label: "Personal" }, "personal");
		await windowA.setActive(work.id);
		await expect(windowB.activeId()).resolves.toBe(work.id);
		await expect(windowA.list()).resolves.toEqual([work, personal]);
	});
});
