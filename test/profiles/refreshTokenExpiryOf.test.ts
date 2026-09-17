import { describe, expect, it } from "vitest";
import { refreshTokenExpiryOf } from "../../src/profiles/refreshTokenExpiryOf";

describe("refreshTokenExpiryOf", () => {
	it("reads claudeAiOauth.refreshTokenExpiresAt", () => {
		expect(refreshTokenExpiryOf('{"claudeAiOauth":{"refreshTokenExpiresAt":1789000000000}}')).toBe(1789000000000);
	});

	it.each([
		["no expiry", '{"claudeAiOauth":{"accessToken":"x"}}'],
		["no oauth block", "{}"],
		["a non-numeric expiry", '{"claudeAiOauth":{"refreshTokenExpiresAt":"soon"}}'],
		["JSON null", "null"],
		["invalid JSON", "not json"]
	])("returns undefined for %s", (_case, credentials) => {
		expect(refreshTokenExpiryOf(credentials)).toBeUndefined();
	});
});
