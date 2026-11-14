import type * as vscode from "vscode";

/** What VS Code keeps for the open workspace alone, across restarts. */
export type WorkspaceMemory = Pick<vscode.ExtensionContext, "environmentVariableCollection" | "workspaceState">;
