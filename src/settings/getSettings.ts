import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { serviceForConfigDir } from "../keychain/serviceForConfigDir";
import { redirectMarker } from "./redirectMarker";

export interface Settings {
	/** macOS: the Keychain item Claude Code reads its login from. */
	keychainService: string;
	/** Linux, Windows, and a Mac whose Keychain rejected the write: the file Claude Code reads its login from. */
	credentialsFile: string;
	claudePath: string;
	syncIntervalMinutes: number;
	showStatusBar: boolean;
	switchScope: "global" | "workspace";
	/** Claude Code's own config folder, whichever account this window uses. Empty means `~/.claude`. */
	baseConfigDir: string;
	/** The saved account this window is redirected to. Unset while it follows the login every window shares. */
	workspaceAccountId?: string;
}

export function getSettings(): Settings {
	const config = vscode.workspace.getConfiguration("claudeAccounts");
	const startConfigDir = process.env[redirectMarker];
	const redirected = startConfigDir !== undefined;
	const baseConfigDir =
		expandHome(config.get<string>("claudeConfigDir", "").trim()) || (redirected ? startConfigDir : process.env.CLAUDE_CONFIG_DIR) || "";
	const configDir = (redirected && process.env.CLAUDE_CONFIG_DIR) || baseConfigDir;
	return {
		// The setting names the shared login's item, which a redirected window must not touch.
		keychainService: (!redirected && config.get<string>("keychainService", "").trim()) || serviceForConfigDir(configDir),
		credentialsFile: path.join(configDir || path.join(os.homedir(), ".claude"), ".credentials.json"),
		claudePath: config.get<string>("claudePath", ""),
		syncIntervalMinutes: config.get<number>("syncIntervalMinutes", 5),
		showStatusBar: config.get<boolean>("showStatusBar", true),
		switchScope: config.get<Settings["switchScope"]>("switchScope", "global"),
		baseConfigDir,
		workspaceAccountId: redirected ? path.basename(configDir) : undefined
	};
}

/** A shell expands `~` before Claude Code sees CLAUDE_CONFIG_DIR, but a setting arrives as typed. */
function expandHome(dir: string): string {
	return dir === "~" || dir.startsWith("~/") ? path.join(os.homedir(), dir.slice(1)) : dir;
}
