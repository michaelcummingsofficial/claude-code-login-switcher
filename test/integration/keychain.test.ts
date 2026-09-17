import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { deleteSecret } from "../../src/keychain/deleteSecret";
import { readSecret } from "../../src/keychain/readSecret";
import { writeSecret } from "../../src/keychain/writeSecret";

/**
 * Runs against the real login Keychain, so it is opt-in: `pnpm test:keychain` on macOS.
 * Every item it creates uses a throwaway service name and is deleted afterwards.
 */
const enabled = process.platform === "darwin" && process.env.KEYCHAIN_TESTS === "1";
const service = `Claude Account Switcher-test-${randomUUID()}`;

const tricky = JSON.stringify({
	claudeAiOauth: {
		accessToken: 'fake"token\\with\\\\quotes',
		refreshToken: "fake-refresh-$(whoami)`id`'single'",
		expiresAt: 1789000000000,
		scopes: ["user:inference", "user:profile"],
		subscriptionType: "team"
	}
});

describe.runIf(enabled)("macOS Keychain", () => {
	afterAll(async () => {
		await deleteSecret(service);
	});

	it("reads a missing item as null", async () => {
		await expect(readSecret(`Claude Account Switcher-test-missing-${randomUUID()}`)).resolves.toBeNull();
	});

	it("round-trips quotes, backslashes and shell syntax exactly through stdin", async () => {
		await writeSecret(service, tricky);
		await expect(readSecret(service)).resolves.toBe(tricky);
	});

	it("round-trips a payload past the stdin limit through the hex form", async () => {
		const large = JSON.stringify({ claudeAiOauth: { accessToken: "x".repeat(5000), quote: 'a"b\\c' } });
		await writeSecret(service, large);
		await expect(readSecret(service)).resolves.toBe(large);
	});

	it("overwrites an existing item", async () => {
		await writeSecret(service, tricky);
		await expect(readSecret(service)).resolves.toBe(tricky);
	});

	it("deletes the item once, then reports it gone", async () => {
		await expect(deleteSecret(service)).resolves.toBe(true);
		await expect(deleteSecret(service)).resolves.toBe(false);
		await expect(readSecret(service)).resolves.toBeNull();
	});
});
