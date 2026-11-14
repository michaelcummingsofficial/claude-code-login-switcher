import { describe, expect, it } from "vitest";
import { isSuperseded } from "../../src/profiles/isSuperseded";

const login = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { expiresAt } });

describe("isSuperseded", () => {
	it("is true only when the other copy was refreshed later", () => {
		expect(isSuperseded(login(1000), login(2000))).toBe(true);
		expect(isSuperseded(login(2000), login(1000))).toBe(false);
		expect(isSuperseded(login(1000), login(1000))).toBe(false);
	});

	it("prefers a later sign-in over an older one that refreshed more recently", () => {
		const renewed = JSON.stringify({ claudeAiOauth: { expiresAt: 1000, refreshTokenExpiresAt: 9_000_000 } });
		const previous = JSON.stringify({ claudeAiOauth: { expiresAt: 2000, refreshTokenExpiresAt: 5_000_000 } });
		expect(isSuperseded(previous, renewed)).toBe(true);
		expect(isSuperseded(renewed, previous)).toBe(false);
	});

	it("orders refreshes of one login by when they happened, whichever way their expiries drifted", () => {
		const spent = JSON.stringify({ claudeAiOauth: { expiresAt: 1000, refreshTokenExpiresAt: 5_000_400 } });
		const refreshed = JSON.stringify({ claudeAiOauth: { expiresAt: 2000, refreshTokenExpiresAt: 5_000_000 } });
		expect(isSuperseded(spent, refreshed)).toBe(true);
		expect(isSuperseded(refreshed, spent)).toBe(false);
	});

	it("treats a copy without an expiry as the oldest", () => {
		expect(isSuperseded("work-tokens", login(1000))).toBe(true);
		expect(isSuperseded(login(1000), "work-tokens")).toBe(false);
		expect(isSuperseded("work-tokens", "personal-tokens")).toBe(false);
	});
});
