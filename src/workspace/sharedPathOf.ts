import os from "node:os";
import path from "node:path";
import { getSettings } from "../settings/getSettings";
import { sharedConfigDir } from "./sharedConfigDir";

/** Where the shared counterpart of `name`, an entry at the top of a login folder, lives. */
export function sharedPathOf(name: string): string {
	// Without CLAUDE_CONFIG_DIR this file sits beside `~/.claude`. With it, Claude Code looks inside the folder.
	if (name === ".claude.json" && !getSettings().baseConfigDir) {
		return path.join(os.homedir(), ".claude.json");
	}

	return path.join(sharedConfigDir(), name);
}
