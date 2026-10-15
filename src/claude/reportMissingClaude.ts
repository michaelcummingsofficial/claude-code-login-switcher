import * as vscode from "vscode";

const INSTALL = "Install Claude Code";
const SET_PATH = "Set the path";

export async function reportMissingClaude(): Promise<void> {
	const choice = await vscode.window.showErrorMessage(
		"Claude Code was not found. Install it, or set its path if it is already installed.",
		INSTALL,
		SET_PATH
	);
	if (choice === INSTALL) {
		await vscode.env.openExternal(vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code"));
	}

	if (choice === SET_PATH) {
		await vscode.commands.executeCommand("workbench.action.openSettings", "claudeAccounts.claudePath");
	}
}
