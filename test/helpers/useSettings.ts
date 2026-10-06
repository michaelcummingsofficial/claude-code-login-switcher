import { type Mock, vi } from "vitest";
import { workspace } from "../mocks/vscode";

/**
 * Answers `claudeAccounts.*` lookups from `values`, falling back to each setting's default. `workspaceValues`
 * are the ones set for the workspace itself. Resolves the mock that receives setting updates.
 */
export function useSettings(values: Record<string, unknown>, workspaceValues: Record<string, unknown> = {}): Mock {
	const update = vi.fn();
	workspace.getConfiguration.mockReturnValue({
		get: (key: string, fallback: unknown) => (key in values ? values[key] : fallback),
		inspect: (key: string) => ({ workspaceValue: workspaceValues[key] }),
		update
	});
	return update;
}
