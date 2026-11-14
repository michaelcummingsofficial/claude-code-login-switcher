import * as vscode from "vscode";
import { claudeCommand } from "../claude/claudeCommand";
import { reportMissingClaude } from "../claude/reportMissingClaude";
import { resolveClaudePath } from "../claude/resolveClaudePath";
import { waitForLogin } from "../claude/waitForLogin";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { detectActiveProfile } from "../profiles/detectActiveProfile";
import { isLoginEnded } from "../profiles/isLoginEnded";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";
import { useWorkspaceAccount } from "../workspace/useWorkspaceAccount";
import { saveCurrentAccount } from "./saveCurrentAccount";

/**
 * `claude auth login` overwrites the live login, so the account that is
 * currently signed in has to be banked first or its refresh token is lost.
 *
 * A workspace login has nothing to overwrite. A saved account signs in again where its login already lives, and a
 * new one signs in to a folder of its own, named with the id it is then saved under.
 *
 * `target` is a saved account to log in to again, which keeps its name and place instead of being saved anew.
 */
export async function addAccount(store: ProfileStore, target?: Profile): Promise<void> {
	await syncActiveAccount(store);
	const settings = getSettings();
	const scoped = settings.switchScope === "workspace";
	const live = scoped ? null : await (await resolveLiveCredential()).read();
	if (live && !isLoginEnded(live) && !(await detectActiveProfile(store, live))) {
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
		void reportMissingClaude();
		return;
	}

	if (scoped) {
		await useWorkspaceAccount(store, target?.id ?? (await store.pendingLoginId()));
	} else {
		// A sync during the login would copy the new account's tokens over the one that was just synced.
		await store.setActive(null);
	}

	const before = scoped ? await (await resolveLiveCredential()).read() : live;
	// The CLI is the terminal's process, so no shell has to parse the path.
	const command = claudeCommand(claudePath, ["auth", "login"]);
	const terminal = vscode.window.createTerminal({
		name: "Claude login",
		shellPath: command.file,
		shellArgs: command.verbatim ? command.args.join(" ") : command.args,
		env: scoped ? { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR ?? null } : undefined
	});
	terminal.show();
	const loggedIn = await waitForLogin(
		terminal,
		before,
		target
			? `Finish logging in to "${target.label}" in your browser.${target.email ? ` Sign in as ${target.email}.` : ""}`
			: "Finish logging in to Claude in your browser."
	);
	const saved = loggedIn ? await saveCurrentAccount(store, target) : null;
	if (scoped) {
		await useWorkspaceAccount(store, saved?.id ?? settings.workspaceAccountId);
	}
}
