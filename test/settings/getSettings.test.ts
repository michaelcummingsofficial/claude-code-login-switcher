import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getSettings } from "../../src/settings/getSettings";
import { redirectMarker } from "../../src/settings/redirectMarker";
import { useSettings } from "../helpers/useSettings";
import { workspace } from "../mocks/vscode";

describe("getSettings", () => {
	it("reads the claudeAccounts section with the manifest defaults", () => {
		expect(getSettings()).toEqual({
			keychainService: "Claude Code-credentials",
			credentialsFile: path.join(os.homedir(), ".claude", ".credentials.json"),
			claudePath: "",
			syncIntervalMinutes: 5,
			showStatusBar: true,
			switchScope: "global",
			baseConfigDir: "",
			workspaceAccountId: undefined
		});
		expect(workspace.getConfiguration).toHaveBeenCalledWith("claudeAccounts");
	});

	it("follows CLAUDE_CONFIG_DIR, like Claude Code", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		expect(getSettings()).toMatchObject({
			keychainService: "Claude Code-credentials-519e587f",
			credentialsFile: path.join("/tmp/cfg", ".credentials.json")
		});
	});

	it("prefers the claudeConfigDir setting over CLAUDE_CONFIG_DIR", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/elsewhere");
		useSettings({ claudeConfigDir: " /tmp/cfg " });
		expect(getSettings()).toMatchObject({
			keychainService: "Claude Code-credentials-519e587f",
			credentialsFile: path.join("/tmp/cfg", ".credentials.json")
		});
	});

	it("expands ~ in the claudeConfigDir setting", () => {
		useSettings({ claudeConfigDir: "~/.claude-work" });
		expect(getSettings().credentialsFile).toBe(path.join(os.homedir(), ".claude-work", ".credentials.json"));
	});

	it("passes CLAUDE_CONFIG_DIR through as written, since Claude Code hashes that exact value", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "~/.claude-work");
		expect(getSettings().credentialsFile).toBe(path.join("~/.claude-work", ".credentials.json"));
	});

	it("prefers an explicit Keychain item, trimmed, over the derived one", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		useSettings({ keychainService: "  Custom-credentials " });
		expect(getSettings().keychainService).toBe("Custom-credentials");
	});

	it.each([["keychainService"], ["claudeConfigDir"]])("treats a blank %s as unset", (key) => {
		useSettings({ [key]: "   " });
		expect(getSettings()).toMatchObject({
			keychainService: "Claude Code-credentials",
			credentialsFile: path.join(os.homedir(), ".claude", ".credentials.json")
		});
	});

	it("passes the other settings through", () => {
		useSettings({ claudePath: "/bin/claude", syncIntervalMinutes: 0, showStatusBar: false, switchScope: "workspace" });
		expect(getSettings()).toMatchObject({ claudePath: "/bin/claude", syncIntervalMinutes: 0, showStatusBar: false, switchScope: "workspace" });
	});

	it("reports the folder Claude Code would use on its own as the base", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		expect(getSettings()).toMatchObject({ baseConfigDir: "/tmp/cfg", workspaceAccountId: undefined });
	});

	describe("while redirected to a workspace account", () => {
		const loginDir = path.join("/accounts", "logins", "work-id");

		it("reads the login from that account's folder and names the account", () => {
			vi.stubEnv(redirectMarker, "");
			vi.stubEnv("CLAUDE_CONFIG_DIR", loginDir);
			expect(getSettings()).toMatchObject({
				credentialsFile: path.join(loginDir, ".credentials.json"),
				baseConfigDir: "",
				workspaceAccountId: "work-id"
			});
		});

		it("keeps the folder VS Code started with as the base", () => {
			vi.stubEnv(redirectMarker, "/tmp/cfg");
			vi.stubEnv("CLAUDE_CONFIG_DIR", loginDir);
			expect(getSettings().baseConfigDir).toBe("/tmp/cfg");
		});

		it("ignores the keychainService setting, which names the shared login", () => {
			vi.stubEnv(redirectMarker, "");
			vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
			useSettings({ keychainService: "Custom-credentials" });
			expect(getSettings().keychainService).toBe("Claude Code-credentials-519e587f");
		});
	});
});
