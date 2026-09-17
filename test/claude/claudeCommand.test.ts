import { describe, expect, it, vi } from "vitest";
import { claudeCommand } from "../../src/claude/claudeCommand";
import { usePlatform } from "../helpers/usePlatform";

describe("claudeCommand", () => {
	it.each(["darwin", "linux"] as const)("runs the CLI directly on %s", (platform) => {
		usePlatform(platform);
		expect(claudeCommand("/opt/homebrew/bin/claude", ["auth", "login"])).toEqual({
			file: "/opt/homebrew/bin/claude",
			args: ["auth", "login"],
			verbatim: false
		});
	});

	it("runs the native claude.exe directly on Windows", () => {
		usePlatform("win32");
		expect(claudeCommand("C:\\Users\\Ada\\.local\\bin\\claude.exe", ["auth", "status", "--json"])).toEqual({
			file: "C:\\Users\\Ada\\.local\\bin\\claude.exe",
			args: ["auth", "status", "--json"],
			verbatim: false
		});
	});

	it.each(["claude.cmd", "CLAUDE.BAT"])("runs npm's %s shim through cmd.exe with a quoted path on Windows", (name) => {
		usePlatform("win32");
		vi.stubEnv("ComSpec", "C:\\Windows\\system32\\cmd.exe");
		const shim = `C:\\Users\\Ada Lovelace\\AppData\\Roaming\\npm\\${name}`;
		expect(claudeCommand(shim, ["auth", "login"])).toEqual({
			file: "C:\\Windows\\system32\\cmd.exe",
			args: ["/d", "/s", "/c", `""${shim}" auth login"`],
			verbatim: true
		});
	});

	it("falls back to cmd.exe when ComSpec is unset", () => {
		usePlatform("win32");
		vi.stubEnv("ComSpec", undefined);
		expect(claudeCommand("C:\\npm\\claude.cmd", ["auth", "login"]).file).toBe("cmd.exe");
	});
});
