import { describe, expect, it, vi } from "vitest";
import { redirectMarker } from "../../src/settings/redirectMarker";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";

describe("redirectConfigDir", () => {
	it("points CLAUDE_CONFIG_DIR at the folder, then clears it again", () => {
		redirectConfigDir("/accounts/logins/work-id");
		expect(process.env.CLAUDE_CONFIG_DIR).toBe("/accounts/logins/work-id");
		expect(process.env[redirectMarker]).toBe("");
		redirectConfigDir(undefined);
		expect(process.env.CLAUDE_CONFIG_DIR).toBeUndefined();
		expect(process.env[redirectMarker]).toBeUndefined();
	});

	it("puts back the folder VS Code started with, even after a second redirect", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		redirectConfigDir("/accounts/logins/work-id");
		redirectConfigDir("/accounts/logins/personal-id");
		expect(process.env.CLAUDE_CONFIG_DIR).toBe("/accounts/logins/personal-id");
		expect(process.env[redirectMarker]).toBe("/tmp/cfg");
		redirectConfigDir(undefined);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe("/tmp/cfg");
	});

	it("leaves the variable alone when there is no redirect to undo", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		redirectConfigDir(undefined);
		expect(process.env.CLAUDE_CONFIG_DIR).toBe("/tmp/cfg");
	});
});
