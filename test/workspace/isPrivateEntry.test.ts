import { describe, expect, it } from "vitest";
import { isPrivateEntry } from "../../src/workspace/isPrivateEntry";

describe("isPrivateEntry", () => {
	it.each([
		[".credentials.json", true],
		[".claude.json.lock", true],
		[".claude.json", false],
		["projects", false]
	])("%s stays private: %s", (name, expected) => {
		expect(isPrivateEntry(name)).toBe(expected);
	});
});
