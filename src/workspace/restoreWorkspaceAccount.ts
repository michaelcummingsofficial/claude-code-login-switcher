import fs from "node:fs";
import path from "node:path";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";
import { everywhereAccountFor } from "./everywhereAccountFor";
import { loginDirFor } from "./loginDirFor";
import { pickedAtKey } from "./pickedAtKey";
import { redirectConfigDir } from "./redirectConfigDir";
import { rememberWorkspaceAccount } from "./rememberWorkspaceAccount";
import { useWorkspaceAccount } from "./useWorkspaceAccount";
import type { WorkspaceMemory } from "./WorkspaceMemory";

/**
 * Puts this window back on the account its workspace last used, or on the shared login when the scope is global.
 * An account signed in everywhere since the workspace last picked one wins. A pick of an account that is gone is
 * dropped.
 */
export async function restoreWorkspaceAccount(memory: WorkspaceMemory, store: ProfileStore): Promise<void> {
	const dir = memory.environmentVariableCollection.get("CLAUDE_CONFIG_DIR")?.value;
	const scoped = getSettings().switchScope === "workspace";
	const pinned = scoped && dir ? path.basename(dir) : undefined;
	const { sharedId, profiles } = store.snapshot();
	const everywhere = scoped ? everywhereAccountFor(memory, store) : undefined;
	const id = everywhere ?? (profiles.some((profile) => profile.id === pinned) ? pinned : undefined);
	const loginDir = id && id !== sharedId && loginDirFor(store.dir, id);
	// Claude Code reads the login as soon as it activates, often alongside this restore, so the redirect can't wait.
	if (loginDir && fs.existsSync(loginDir)) {
		redirectConfigDir(loginDir);
	}

	try {
		await useWorkspaceAccount(store, id);
		if (everywhere) {
			await memory.workspaceState.update(pickedAtKey, Date.now());
		}
	} finally {
		rememberWorkspaceAccount(memory);
	}
}
