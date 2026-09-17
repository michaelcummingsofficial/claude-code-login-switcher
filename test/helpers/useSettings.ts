import { workspace } from "../mocks/vscode";

/** Answers `claudeAccounts.*` lookups from `values`, falling back to each setting's default. */
export function useSettings(values: Record<string, unknown>): void {
	workspace.getConfiguration.mockReturnValue({ get: (key: string, fallback: unknown) => (key in values ? values[key] : fallback) });
}
