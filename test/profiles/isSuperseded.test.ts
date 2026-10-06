import { describe, expect, it } from "vitest";
import { isSuperseded } from "../../src/profiles/isSuperseded";

const login = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { expiresAt } });

describe("isSuperseded", () => {
	it("is true only when the other copy was refreshed later", () => {
		expect(isSuperseded(login(1000), login(2000))).toBe(true);
		expect(isSuperseded(login(2000), login(1000))).toBe(false);
		expect(isSuperseded(login(1000), login(1000))).toBe(false);
	});

	it("treats a copy without an expiry as the oldest", () => {
		expect(isSuperseded("work-tokens", login(1000))).toBe(true);
		expect(isSuperseded(login(1000), "work-tokens")).toBe(false);
		expect(isSuperseded("work-tokens", "personal-tokens")).toBe(false);
	});
});
