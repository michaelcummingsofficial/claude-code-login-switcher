import { describe, expect, it } from "vitest";
import { oauthTimestampOf } from "../../src/profiles/oauthTimestampOf";

describe("oauthTimestampOf", () => {
	it("reads the named claudeAiOauth field", () => {
		const credentials = '{"claudeAiOauth":{"expiresAt":1700000000000,"refreshTokenExpiresAt":1789000000000}}';
		expect(oauthTimestampOf(credentials, "expiresAt")).toBe(1700000000000);
		expect(oauthTimestampOf(credentials, "refreshTokenExpiresAt")).toBe(1789000000000);
	});
});
