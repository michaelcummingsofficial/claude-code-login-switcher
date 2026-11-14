import { describe, expect, it } from "vitest";
import { isLaterLogin } from "../../src/profiles/isLaterLogin";

const signIn = (refreshTokenExpiresAt: number) => JSON.stringify({ claudeAiOauth: { refreshTokenExpiresAt } });

describe("isLaterLogin", () => {
	it("is true only for the sign-in whose refresh token expires more than a minute later", () => {
		expect(isLaterLogin(signIn(60_001), signIn(0))).toBe(true);
		expect(isLaterLogin(signIn(0), signIn(60_001))).toBe(false);
		expect(isLaterLogin(signIn(1000), signIn(1000))).toBe(false);
	});

	it("treats copies whose expiry a refresh recomputed as the same login", () => {
		expect(isLaterLogin(signIn(1_797_188_649_351), signIn(1_797_188_648_951))).toBe(false);
		expect(isLaterLogin(signIn(1_797_188_648_951), signIn(1_797_188_649_351))).toBe(false);
		expect(isLaterLogin(signIn(60_000), signIn(0))).toBe(false);
	});

	it("cannot tell when either login does not record its expiry", () => {
		expect(isLaterLogin(signIn(2000), "work-tokens")).toBe(false);
		expect(isLaterLogin("work-tokens", signIn(1000))).toBe(false);
	});
});
