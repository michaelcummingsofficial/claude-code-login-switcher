import { describe, expect, it } from "vitest";
import { isLoginEnded } from "../../src/profiles/isLoginEnded";

describe("isLoginEnded", () => {
	it("spots the blank tokens Claude Code leaves once a refresh is refused", () => {
		expect(isLoginEnded('{"claudeAiOauth":{"accessToken":"","refreshToken":"","expiresAt":0}}')).toBe(true);
	});

	it.each([['{"claudeAiOauth":{"accessToken":"a","refreshToken":"r"}}'], ['{"claudeAiOauth":{"accessToken":"a"}}'], ["not json"]])(
		"treats %s as a login still in use",
		(credentials) => {
			expect(isLoginEnded(credentials)).toBe(false);
		}
	);
});
