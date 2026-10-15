import * as vscode from "vscode";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";

interface Login {
	dir: string | undefined;
	account: string | null;
}

/**
 * Claude Code checks the login when it starts and keeps the answer, so a panel that is already open stays on
 * the account it started with. Restarting the extension host starts it again on the new login, and it picks its
 * sessions back up.
 */
export class ClaudeCodeRestarter {
	private restarting = false;

	constructor(private readonly store: ProfileStore) {}

	/** Runs `change`, then restarts Claude Code when the change moved this window to another login. */
	async follow(change: () => Promise<unknown>): Promise<void> {
		if (!getSettings().restartClaudeCode || !vscode.extensions.getExtension("anthropic.claude-code")?.isActive) {
			await change();
			return;
		}

		const before = await this.login();
		await change();
		const after = await this.login();
		// Saving the login in use, or removing its account, moves the active account to or from none. The tokens stay put.
		const switched = before.account !== null && after.account !== null && before.account !== after.account;
		// A settings change and the command that made it can both see the same switch, and one restart covers both.
		if (this.restarting || (before.dir === after.dir && !switched)) {
			return;
		}

		this.restarting = true;
		try {
			await vscode.commands.executeCommand("workbench.action.restartExtensionHost");
		} finally {
			this.restarting = false;
		}
	}

	private async login(): Promise<Login> {
		return { dir: process.env.CLAUDE_CONFIG_DIR, account: await this.store.activeId() };
	}
}
