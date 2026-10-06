import path from "node:path";
import { describe, expect, it } from "vitest";
import { loginDirFor } from "../../src/workspace/loginDirFor";

describe("loginDirFor", () => {
	it("names the folder after the account, inside the store", () => {
		expect(loginDirFor("/accounts", "work-id")).toBe(path.join("/accounts", "logins", "work-id"));
	});
});
