import { describe, expect, it } from "vitest";
import { oauthOf } from "../../src/profiles/oauthOf";

describe("oauthOf", () => {
	it("returns the claudeAiOauth block", () => {
		expect(oauthOf('{"claudeAiOauth":{"subscriptionType":"max"}}')).toEqual({ subscriptionType: "max" });
	});

	it.each([
		["no oauth block", "{}"],
		["JSON null", "null"],
		["invalid JSON", "not json"]
	])("returns undefined for %s", (_case, credentials) => {
		expect(oauthOf(credentials)).toBeUndefined();
	});
});
