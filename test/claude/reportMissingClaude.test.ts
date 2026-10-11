import { describe, expect, it } from "vitest";
import { reportMissingClaude } from "../../src/claude/reportMissingClaude";
import { commands, env, window } from "../mocks/vscode";

describe("reportMissingClaude", () => {
	it("offers to install Claude Code or set its path", async () => {
		await reportMissingClaude();
		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"Claude Code was not found. Install it, or set its path if it is already installed.",
			"Install Claude Code",
			"Set the path"
		);
		expect(env.openExternal).not.toHaveBeenCalled();
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("opens the Claude Code install page", async () => {
		window.showErrorMessage.mockResolvedValue("Install Claude Code");
		await reportMissingClaude();
		expect(env.openExternal).toHaveBeenCalledWith({ url: "https://docs.anthropic.com/en/docs/claude-code" });
	});

	it("opens Settings on the path setting", async () => {
		window.showErrorMessage.mockResolvedValue("Set the path");
		await reportMissingClaude();
		expect(commands.executeCommand).toHaveBeenCalledWith("workbench.action.openSettings", "claudeAccounts.claudePath");
	});
});
