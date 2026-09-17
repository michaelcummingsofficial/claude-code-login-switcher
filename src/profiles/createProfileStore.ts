import os from "node:os";
import path from "node:path";
import type * as vscode from "vscode";
import { KeychainVault } from "../keychain/KeychainVault";
import { ProfileStore } from "./ProfileStore";

/**
 * On macOS, saved accounts live in `~/.claude-accounts` with their tokens in the Keychain, shared by every
 * editor on the Mac. Elsewhere the tokens go in VS Code's secret storage, which belongs to one editor, so the
 * account list stays in that editor's storage folder too and the two never disagree.
 */
export function createProfileStore(context: vscode.ExtensionContext): ProfileStore {
	if (process.platform === "darwin") {
		return new ProfileStore(path.join(os.homedir(), ".claude-accounts"), new KeychainVault());
	}

	return new ProfileStore(context.globalStorageUri.fsPath, context.secrets);
}
