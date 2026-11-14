import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sharedPathOf } from "../../src/workspace/sharedPathOf";
import { useSettings } from "../helpers/useSettings";

describe("sharedPathOf", () => {
	it("finds an entry inside the shared folder", () => {
		useSettings({ claudeConfigDir: path.resolve("config") });
		expect(sharedPathOf("projects")).toBe(path.resolve("config", "projects"));
		expect(sharedPathOf(".claude.json")).toBe(path.resolve("config", ".claude.json"));
	});

	it("finds the global config beside ~/.claude when Claude Code uses its default folder", () => {
		vi.spyOn(os, "homedir").mockReturnValue(path.resolve("home"));
		expect(sharedPathOf(".claude.json")).toBe(path.join(path.resolve("home"), ".claude.json"));
		expect(sharedPathOf("projects")).toBe(path.resolve("home", ".claude", "projects"));
	});
});
