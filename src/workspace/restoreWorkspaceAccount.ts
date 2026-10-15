import fs from "node:fs";
import path from "node:path";
import type * as vscode from "vscode";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";
import { loginDirFor } from "./loginDirFor";
import { redirectConfigDir } from "./redirectConfigDir";
import { rememberWorkspaceAccount } from "./rememberWorkspaceAccount";
import { useWorkspaceAccount } from "./useWorkspaceAccount";

/** Puts this window back on the account its workspace last used, or on the shared login when the scope is global. */
export async function restoreWorkspaceAccount(environment: vscode.EnvironmentVariableCollection, store: ProfileStore): Promise<void> {
	const dir = environment.get("CLAUDE_CONFIG_DIR")?.value;
	const id = getSettings().switchScope === "workspace" && dir ? path.basename(dir) : undefined;
	const loginDir = id && loginDirFor(store.dir, id);
	// Claude Code reads the login as soon as it activates, often alongside this restore, so the redirect can't wait.
	if (loginDir && fs.existsSync(loginDir)) {
		redirectConfigDir(loginDir);
	}

	const saved = (await store.list()).some((profile) => profile.id === id);
	try {
		await useWorkspaceAccount(store, saved ? id : undefined);
	} finally {
		rememberWorkspaceAccount(environment);
	}
}
