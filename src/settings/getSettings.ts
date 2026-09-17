import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { serviceForConfigDir } from "../keychain/serviceForConfigDir";

export interface Settings {
	/** macOS: the Keychain item Claude Code reads its login from. */
	keychainService: string;
	/** Linux, Windows, and a Mac whose Keychain rejected the write: the file Claude Code reads its login from. */
	credentialsFile: string;
	claudePath: string;
	syncIntervalMinutes: number;
	showStatusBar: boolean;
}

export function getSettings(): Settings {
	const config = vscode.workspace.getConfiguration("claudeAccounts");
	const configDir = expandHome(config.get<string>("claudeConfigDir", "").trim()) || process.env.CLAUDE_CONFIG_DIR || "";
	return {
		keychainService: config.get<string>("keychainService", "").trim() || serviceForConfigDir(configDir),
		credentialsFile: path.join(configDir || path.join(os.homedir(), ".claude"), ".credentials.json"),
		claudePath: config.get<string>("claudePath", ""),
		syncIntervalMinutes: config.get<number>("syncIntervalMinutes", 5),
		showStatusBar: config.get<boolean>("showStatusBar", true)
	};
}

/** A shell expands `~` before Claude Code sees CLAUDE_CONFIG_DIR, but a setting arrives as typed. */
function expandHome(dir: string): string {
	return dir === "~" || dir.startsWith("~/") ? path.join(os.homedir(), dir.slice(1)) : dir;
}
