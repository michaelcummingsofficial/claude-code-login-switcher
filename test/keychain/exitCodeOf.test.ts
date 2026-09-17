import { describe, expect, it } from "vitest";
import { exitCodeOf } from "../../src/keychain/exitCodeOf";

describe("exitCodeOf", () => {
	it("returns a numeric exit code", () => {
		expect(exitCodeOf({ code: 44 })).toBe(44);
	});

	it("returns null for spawn failures, which carry a string code", () => {
		expect(exitCodeOf({ code: "ENOENT" })).toBeNull();
	});

	it.each([null, undefined, "boom", {}])("returns null for %j", (value) => {
		expect(exitCodeOf(value)).toBeNull();
	});
});
