import type * as vscode from "vscode";
import { getSettings } from "../settings/getSettings";

/**
 * VS Code keeps this collection per workspace, so it carries the redirect to new terminals and across restarts.
 */
export function rememberWorkspaceAccount(environment: vscode.EnvironmentVariableCollection): void {
	const dir = getSettings().workspaceAccountId ? process.env.CLAUDE_CONFIG_DIR : undefined;
	if (!dir) {
		environment.delete("CLAUDE_CONFIG_DIR");
	} else if (environment.get("CLAUDE_CONFIG_DIR")?.value !== dir) {
		environment.replace("CLAUDE_CONFIG_DIR", dir);
	}
}
