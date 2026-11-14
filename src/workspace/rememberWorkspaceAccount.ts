import { getSettings } from "../settings/getSettings";
import { pickedAtKey } from "./pickedAtKey";
import type { WorkspaceMemory } from "./WorkspaceMemory";

/**
 * VS Code keeps this collection per workspace, so it carries the redirect to new terminals and across restarts.
 * The time of each change lets a later switch everywhere tell which workspaces it overrides.
 */
export function rememberWorkspaceAccount(memory: WorkspaceMemory): void {
	const environment = memory.environmentVariableCollection;
	const dir = getSettings().workspaceAccountId ? process.env.CLAUDE_CONFIG_DIR : undefined;
	if (environment.get("CLAUDE_CONFIG_DIR")?.value === dir) {
		return;
	}

	if (dir) {
		environment.replace("CLAUDE_CONFIG_DIR", dir);
	} else {
		environment.delete("CLAUDE_CONFIG_DIR");
	}

	void memory.workspaceState.update(pickedAtKey, Date.now());
}
