import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveClaudePath } from "../../src/claude/resolveClaudePath";
import { usePlatform } from "../helpers/usePlatform";

function existing(...paths: string[]): void {
	vi.spyOn(fs, "existsSync").mockImplementation((candidate) => paths.includes(String(candidate)));
}

describe("resolveClaudePath", () => {
	it("uses the configured path, trimmed, without probing", () => {
		const existsSync = vi.spyOn(fs, "existsSync");
		expect(resolveClaudePath("  /custom/claude ")).toBe("/custom/claude");
		expect(existsSync).not.toHaveBeenCalled();
	});

	it("searches PATH in order", () => {
		usePlatform("darwin");
		vi.stubEnv("PATH", ["/first", "/second", "/third"].join(path.delimiter));
		existing(path.join("/second", "claude"), path.join("/third", "claude"));
		expect(resolveClaudePath("")).toBe(path.join("/second", "claude"));
	});

	it("returns null when the CLI is nowhere, even without a PATH", () => {
		usePlatform("linux");
		vi.stubEnv("PATH", undefined);
		existing();
		expect(resolveClaudePath("")).toBeNull();
	});

	describe.each([
		[
			"darwin",
			[
				"/opt/homebrew/bin/claude",
				"/usr/local/bin/claude",
				path.join(os.homedir(), ".local/bin/claude"),
				path.join(os.homedir(), ".claude/local/claude")
			]
		],
		[
			"linux",
			[
				path.join(os.homedir(), ".local/bin/claude"),
				path.join(os.homedir(), ".claude/local/claude"),
				"/usr/local/bin/claude",
				"/home/linuxbrew/.linuxbrew/bin/claude"
			]
		]
	] as const)("on %s", (platform, installs) => {
		it.each(installs)("falls back to %s when PATH lacks the CLI", (install) => {
			usePlatform(platform);
			vi.stubEnv("PATH", "/usr/bin");
			existing(path.join(install));
			expect(resolveClaudePath("   ")).toBe(path.join(install));
		});
	});

	describe("on Windows", () => {
		it("finds the native claude.exe before npm's claude.cmd in the same folder", () => {
			usePlatform("win32");
			const tools = path.join(os.homedir(), "tools");
			vi.stubEnv("PATH", tools);
			existing(path.join(tools, "claude.exe"), path.join(tools, "claude.cmd"));
			expect(resolveClaudePath("")).toBe(path.join(tools, "claude.exe"));
		});

		it("falls back to the native installer, then npm's global folder", () => {
			usePlatform("win32");
			vi.stubEnv("PATH", "");
			vi.stubEnv("APPDATA", "C:\\Users\\Ada\\AppData\\Roaming");
			const native = path.join(os.homedir(), ".local", "bin", "claude.exe");
			const npm = path.join("C:\\Users\\Ada\\AppData\\Roaming", "npm", "claude.cmd");
			existing(native, npm);
			expect(resolveClaudePath("")).toBe(native);
			existing(npm);
			expect(resolveClaudePath("")).toBe(npm);
		});

		it("skips npm's folder when APPDATA is unset", () => {
			usePlatform("win32");
			vi.stubEnv("PATH", "");
			vi.stubEnv("APPDATA", undefined);
			existing();
			expect(resolveClaudePath("")).toBeNull();
		});
	});
});
