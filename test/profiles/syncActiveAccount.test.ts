import { describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { syncActiveAccount } from "../../src/profiles/syncActiveAccount";
import { createTempStore } from "../helpers/createTempStore";
import { memoryVault } from "../helpers/memoryVault";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";

vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/credentials/resolveLiveCredential");

const rotated = '{"claudeAiOauth":{"accessToken":"rotated","refreshTokenExpiresAt":1789000000000}}';
const ended = '{"claudeAiOauth":{"accessToken":"","refreshToken":"","expiresAt":0}}';

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

	it("keeps the saved copy when another login of the same account refreshed after this one", async () => {
		const newer = '{"claudeAiOauth":{"accessToken":"newer","expiresAt":2000}}';
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, newer);
		const live = useLiveCredential('{"claudeAiOauth":{"accessToken":"older","expiresAt":1000}}');
		await syncActiveAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe(newer);
		expect(live.value).toContain("older");
	});

	it("puts a login renewed in a workspace back into the shared login Claude Code cleared", async () => {
		const renewed = '{"claudeAiOauth":{"accessToken":"renewed","refreshToken":"r","expiresAt":2000}}';
		const store = createTempStore();
		await store.add({ label: "Work" }, renewed);
		const live = useLiveCredential(ended);
		await syncActiveAccount(store);
		expect(live.value).toBe(renewed);
	});

	it("replaces a login that still works with the account's later sign-in", async () => {
		const renewed = `{"claudeAiOauth":{"accessToken":"renewed","expiresAt":1000,"refreshTokenExpiresAt":${Date.now() + 9_000_000}}}`;
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, renewed);
		const live = useLiveCredential(`{"claudeAiOauth":{"accessToken":"previous","expiresAt":2000,"refreshTokenExpiresAt":${Date.now() + 5_000_000}}}`);
		await syncActiveAccount(store);
		expect(live.value).toBe(renewed);
		await expect(store.credentialsFor(work.id)).resolves.toBe(renewed);
	});

	it("leaves a cleared login alone when the saved copy has expired too", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, `{"claudeAiOauth":{"accessToken":"stale","expiresAt":2000,"refreshTokenExpiresAt":${Date.now() - 1}}}`);
		const live = useLiveCredential(ended);
		await syncActiveAccount(store);
		expect(live.value).toBe(ended);
	});

	it("never saves a sign-in made outside the extension over the active account, which may be someone else's", async () => {
		const store = createTempStore();
		const saved = `{"claudeAiOauth":{"accessToken":"work","refreshTokenExpiresAt":${Date.now() + 5_000_000}}}`;
		const work = await store.add({ label: "Work" }, saved);
		useLiveCredential(`{"claudeAiOauth":{"accessToken":"outside","refreshTokenExpiresAt":${Date.now() + 9_000_000}}}`);
		await syncActiveAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe(saved);
		await expect(store.activeId()).resolves.toBeNull();
	});

	it("keeps a refresh whose recomputed expiry lands a moment before the saved copy's instead of restoring the spent tokens", async () => {
		const lifetimeEnd = Date.now() + 9_000_000;
		const spent = `{"claudeAiOauth":{"accessToken":"a1","refreshToken":"r1","expiresAt":1000,"refreshTokenExpiresAt":${lifetimeEnd + 400}}}`;
		const refreshed = `{"claudeAiOauth":{"accessToken":"a2","refreshToken":"r2","expiresAt":2000,"refreshTokenExpiresAt":${lifetimeEnd}}}`;
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, spent);
		const live = useLiveCredential(refreshed);
		await syncActiveAccount(store);
		expect(live.value).toBe(refreshed);
		await expect(store.credentialsFor(work.id)).resolves.toBe(refreshed);
		await expect(store.activeId()).resolves.toBe(work.id);
	});

	it("keeps the active account when Claude Code says its own owner signed in again", async () => {
		useSettings({ claudePath: "/bin/claude" });
		const store = createTempStore();
		const work = await store.add(
			{ label: "Work", email: "ada@work.com" },
			`{"claudeAiOauth":{"accessToken":"work","refreshTokenExpiresAt":${Date.now() + 5_000_000}}}`
		);
		const renewed = `{"claudeAiOauth":{"accessToken":"renewed","refreshTokenExpiresAt":${Date.now() + 9_000_000}}}`;
		useLiveCredential(renewed);
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true, email: "Ada@Work.com" });
		await syncActiveAccount(store);
		expect(readAuthStatus).toHaveBeenCalledWith("/bin/claude");
		await expect(store.activeId()).resolves.toBe(work.id);
		await expect(store.credentialsFor(work.id)).resolves.toBe(renewed);
	});

	it("stops treating an account as active once Claude Code says someone else signed in", async () => {
		const store = createTempStore();
		const saved = `{"claudeAiOauth":{"accessToken":"work","refreshTokenExpiresAt":${Date.now() + 5_000_000}}}`;
		const work = await store.add({ label: "Work", email: "ada@work.com" }, saved);
		useLiveCredential(`{"claudeAiOauth":{"accessToken":"home","refreshTokenExpiresAt":${Date.now() + 9_000_000}}}`);
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true, email: "ada@home.com" });
		await syncActiveAccount(store);
		await expect(store.activeId()).resolves.toBeNull();
		await expect(store.credentialsFor(work.id)).resolves.toBe(saved);
	});

	it("records a plan change that arrives with refreshed tokens", async () => {
		const store = createTempStore();
		await store.add({ label: "Work", subscriptionType: "pro" }, "work-tokens");
		useLiveCredential('{"claudeAiOauth":{"accessToken":"rotated","subscriptionType":"max"}}');
		await syncActiveAccount(store);
		await expect(store.active()).resolves.toMatchObject({ subscriptionType: "max" });
	});

	it("keeps the saved plan when the refreshed tokens do not name one", async () => {
		const store = createTempStore();
		await store.add({ label: "Work", subscriptionType: "pro" }, "work-tokens");
		useLiveCredential(rotated);
		await syncActiveAccount(store);
		await expect(store.active()).resolves.toMatchObject({ subscriptionType: "pro" });
	});
});
