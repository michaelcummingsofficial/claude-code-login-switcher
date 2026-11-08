import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWarningOf } from "../../src/profiles/loginWarningOf";
import type { Profile } from "../../src/profiles/ProfileStore";

const NOW = 2_000_000_000_000;
const DAY = 86_400_000;
const profile = (refreshTokenExpiresAt?: number): Profile => ({ id: "work", label: "Work", savedAt: 0, refreshTokenExpiresAt });

describe("loginWarningOf", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(NOW);
	});

	it.each([
		["more than three days remain", NOW + 3 * DAY + 1],
		["the expiry is unknown", undefined]
	])("stays quiet while %s", (_case, expiry) => {
		expect(loginWarningOf(profile(expiry))).toBeUndefined();
	});

	it.each([
		[NOW + 3 * DAY, "Login expires in 3 days."],
		[NOW + DAY + 1, "Login expires in 2 days."],
		[NOW + 1, "Login expires in 1 day."]
	])("counts down the last three days, as Claude Code does", (expiry, message) => {
		expect(loginWarningOf(profile(expiry))).toEqual({ expired: false, message });
	});

	it("flags a login past its expiry", () => {
		expect(loginWarningOf(profile(NOW))).toEqual({ expired: true, message: "Login expired." });
	});

	it("flags a live login Claude Code has already ended, whatever the saved expiry says", () => {
		const ended = '{"claudeAiOauth":{"accessToken":"","refreshToken":""}}';
		expect(loginWarningOf(profile(NOW + 30 * DAY), ended)).toEqual({ expired: true, message: "Login expired." });
		expect(loginWarningOf(profile(NOW + 30 * DAY), '{"claudeAiOauth":{"refreshToken":"r"}}')).toBeUndefined();
		expect(loginWarningOf(profile(NOW + 30 * DAY), null)).toBeUndefined();
	});
});
