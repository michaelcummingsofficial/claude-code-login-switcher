import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { sharedConfigDir } from "../../src/workspace/sharedConfigDir";
import { useSettings } from "../helpers/useSettings";

describe("sharedConfigDir", () => {
	it("is ~/.claude by default, even while the window uses a workspace account", () => {
		vi.spyOn(os, "homedir").mockReturnValue(path.resolve("home"));
		redirectConfigDir(path.resolve("accounts", "logins", "work-id"));
		expect(sharedConfigDir()).toBe(path.resolve("home", ".claude"));
	});

	it("is the configured folder when there is one", () => {
		useSettings({ claudeConfigDir: path.resolve("config") });
		expect(sharedConfigDir()).toBe(path.resolve("config"));
	});
});
