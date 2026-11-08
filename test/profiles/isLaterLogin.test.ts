import { describe, expect, it } from "vitest";
import { isLaterLogin } from "../../src/profiles/isLaterLogin";

const signIn = (refreshTokenExpiresAt: number) => JSON.stringify({ claudeAiOauth: { refreshTokenExpiresAt } });

describe("isLaterLogin", () => {
	it("is true only for the sign-in whose refresh token expires later", () => {
		expect(isLaterLogin(signIn(2000), signIn(1000))).toBe(true);
		expect(isLaterLogin(signIn(1000), signIn(2000))).toBe(false);
		expect(isLaterLogin(signIn(1000), signIn(1000))).toBe(false);
	});

	it("cannot tell when either login does not record its expiry", () => {
		expect(isLaterLogin(signIn(2000), "work-tokens")).toBe(false);
		expect(isLaterLogin("work-tokens", signIn(1000))).toBe(false);
	});
});
