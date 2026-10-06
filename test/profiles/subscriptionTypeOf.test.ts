import { describe, expect, it } from "vitest";
import { subscriptionTypeOf } from "../../src/profiles/subscriptionTypeOf";

describe("subscriptionTypeOf", () => {
	it("reads claudeAiOauth.subscriptionType", () => {
		expect(subscriptionTypeOf('{"claudeAiOauth":{"subscriptionType":"max"}}')).toBe("max");
	});

	it.each([
		["no plan", '{"claudeAiOauth":{"accessToken":"x"}}'],
		["a non-string plan", '{"claudeAiOauth":{"subscriptionType":5}}'],
		["invalid JSON", "not json"]
	])("returns undefined for %s", (_case, credentials) => {
		expect(subscriptionTypeOf(credentials)).toBeUndefined();
	});
});
