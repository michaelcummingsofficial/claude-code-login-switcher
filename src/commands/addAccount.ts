import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { claudeCommand } from "../claude/claudeCommand";
import { resolveClaudePath } from "../claude/resolveClaudePath";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "../profiles/detectActiveProfile";
import type { ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";
import { loginDirFor } from "../workspace/loginDirFor";
import { removeLoginDir } from "../workspace/removeLoginDir";
import { useWorkspaceAccount } from "../workspace/useWorkspaceAccount";
import { saveCurrentAccount } from "./saveCurrentAccount";

/**
 * `claude auth login` overwrites the live login, so the account that is
 * currently signed in has to be banked first or its refresh token is lost.
 *
 * A workspace login has nothing to overwrite: the new account signs in to a folder of its own, named with the
 * id it is then saved under.
 */
export async function addAccount(store: ProfileStore): Promise<void> {
	await syncActiveAccount(store);
	const settings = getSettings();
	const staged = settings.switchScope === "workspace" ? randomUUID() : undefined;
	const live = staged ? null : await (await resolveLiveCredential()).read();
	if (live && !(await detectActiveProfile(store, live))) {
		const choice = await vscode.window.showWarningMessage(
			"The account currently signed in is not saved. Logging in will overwrite it.",
			{ modal: true },
			"Save it first",
			"Overwrite"
		);
		if (choice === undefined || (choice === "Save it first" && !(await saveCurrentAccount(store)))) {
			return;
		}
	}

	const claudePath = resolveClaudePath(settings.claudePath);
	if (!claudePath) {
		void vscode.window.showErrorMessage("Could not find the claude CLI. Set claudeAccounts.claudePath to its full path.");
		return;
	}

	if (staged) {
		await useWorkspaceAccount(store, staged);
	}

	// A sync during the login would copy the new account's tokens over the one that was just synced.
	await store.setActive(null);
	// The CLI is the terminal's process, so no shell has to parse the path.
	const command = claudeCommand(claudePath, ["auth", "login"]);
	const terminal = vscode.window.createTerminal({
		name: "Claude login",
		shellPath: command.file,
		shellArgs: command.verbatim ? command.args.join(" ") : command.args,
		env: staged ? { CLAUDE_CONFIG_DIR: loginDirFor(store.dir, staged) } : undefined
	});
	terminal.show();
	const done = await vscode.window.showInformationMessage(
		"Finish the login in the terminal and browser, then save the new account.",
		{ modal: true },
		"I finished logging in"
	);
	const saved = done === "I finished logging in" ? await saveCurrentAccount(store) : null;
	if (staged && saved?.id !== staged) {
		await useWorkspaceAccount(store, saved?.id ?? settings.workspaceAccountId);
		await removeLoginDir(store.dir, staged);
	}
}
