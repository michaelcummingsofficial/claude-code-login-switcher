import { describe, expect, it, vi } from "vitest";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { syncActiveAccount } from "../../src/profiles/syncActiveAccount";
import { createTempStore } from "../helpers/createTempStore";
import { memoryVault } from "../helpers/memoryVault";
import { useLiveCredential } from "../helpers/useLiveCredential";

vi.mock("../../src/credentials/resolveLiveCredential");

const rotated = '{"claudeAiOauth":{"accessToken":"rotated","refreshTokenExpiresAt":1789000000000}}';

describe("syncActiveAccount", () => {
	it("does nothing while signed out", async () => {
		useLiveCredential(null);
		const vault = memoryVault();
		const store = createTempStore(vault);
		const work = await store.add({ label: "Work" }, "work-tokens");
		const storeSecret = vi.spyOn(vault, "store");
		await syncActiveAccount(store);
		expect(storeSecret).not.toHaveBeenCalled();
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
	});

	it("copies rotated live tokens into the active profile and records the new expiry", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		useLiveCredential(rotated);
		await syncActiveAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe(rotated);
		await expect(store.active()).resolves.toMatchObject({ refreshTokenExpiresAt: 1789000000000 });
	});

	it("skips the write when the saved copy is already current", async () => {
		const vault = memoryVault();
		const store = createTempStore(vault);
		await store.add({ label: "Work" }, "work-tokens");
		useLiveCredential("work-tokens");
		const storeSecret = vi.spyOn(vault, "store");
		await syncActiveAccount(store);
		expect(storeSecret).not.toHaveBeenCalled();
	});

	it("detects the active profile when none is recorded", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setActive(null);
		useLiveCredential("work-tokens");
		await syncActiveAccount(store);
		await expect(store.activeId()).resolves.toBe(work.id);
	});

	it("never saves an unrecognized live account over a profile", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setActive(null);
		useLiveCredential("someone-else");
		await syncActiveAccount(store);
		await expect(store.activeId()).resolves.toBeNull();
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
	});

	it("logs and swallows failures so a timer tick never throws", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.mocked(resolveLiveCredential).mockRejectedValue(new Error("security failed (1)"));
		await expect(syncActiveAccount(createTempStore())).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledWith("[claudeAccounts] sync failed", "security failed (1)");
	});
});
