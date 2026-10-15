import * as vscode from "vscode";
import type { Settings } from "./getSettings";

/** Saves a `claudeAccounts.*` setting where it takes effect. */
export async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
	const config = vscode.workspace.getConfiguration("claudeAccounts");
	// A value set for this workspace hides the user setting, so the change has to land where the value is.
	const target = config.inspect(key)?.workspaceValue === undefined ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace;
	await config.update(key, value, target);
}
