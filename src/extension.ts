import * as vscode from "vscode";
import { ClaudeCodeRestarter } from "./claude/ClaudeCodeRestarter";
import { addAccount } from "./commands/addAccount";
import { changeSwitchScope } from "./commands/changeSwitchScope";
import { logInAgain } from "./commands/logInAgain";
import { removeAccount } from "./commands/removeAccount";
import { renameAccount } from "./commands/renameAccount";
import { saveCurrentAccount } from "./commands/saveCurrentAccount";
import { showStatus } from "./commands/showStatus";
import { switchAccount } from "./commands/switchAccount";
import { toggleUsage } from "./commands/toggleUsage";
import { createProfileStore } from "./profiles/createProfileStore";
import type { ProfileStore } from "./profiles/ProfileStore";
import { syncActiveAccount } from "./profiles/syncActiveAccount";
import { getSettings } from "./settings/getSettings";
import { refreshStatusBar } from "./statusBar/refreshStatusBar";
import { UsageStatusItem } from "./statusBar/UsageStatusItem";
import { rememberWorkspaceAccount } from "./workspace/rememberWorkspaceAccount";
import { restoreWorkspaceAccount } from "./workspace/restoreWorkspaceAccount";

/** A command's further arguments come only from the status bar, never from the Command Palette. */
const commands: Record<string, (store: ProfileStore, ...args: unknown[]) => Promise<unknown>> = {
	"claudeAccounts.switch": switchAccount,
	"claudeAccounts.saveCurrent": (accounts) => saveCurrentAccount(accounts),
	"claudeAccounts.addAccount": (accounts) => addAccount(accounts),
	"claudeAccounts.logInAgain": logInAgain,
	"claudeAccounts.remove": removeAccount,
	"claudeAccounts.rename": renameAccount,
	"claudeAccounts.status": showStatus,
	"claudeAccounts.changeScope": changeSwitchScope,
	"claudeAccounts.toggleUsage": toggleUsage
};

let store: ProfileStore | undefined;
let syncTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const accounts = createProfileStore(context);
	store = accounts;
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	const restarter = new ClaudeCodeRestarter(accounts);
	const usage = new UsageStatusItem(accounts);
	const refresh = () => Promise.all([refreshStatusBar(statusBar, accounts), usage.refresh()]);
	const restoreAccount = () =>
		restoreWorkspaceAccount(context.environmentVariableCollection, accounts).catch(
			(error: Error) => void vscode.window.showErrorMessage(error.message)
		);
	const restartSyncTimer = () => {
		stopSyncTimer();
		const minutes = getSettings().syncIntervalMinutes;
		if (minutes > 0) {
			syncTimer = setInterval(() => void syncActiveAccount(accounts).then(refresh), minutes * 60_000);
		}
	};

	context.subscriptions.push(
		statusBar,
		usage,
		{ dispose: stopSyncTimer },
		...Object.entries(commands).map(([id, command]) =>
			vscode.commands.registerCommand(id, (...args: unknown[]) =>
				restarter.follow(async () => {
					try {
						await command(accounts, ...args);
					} catch (error) {
						void vscode.window.showErrorMessage((error as Error).message);
					}

					rememberWorkspaceAccount(context.environmentVariableCollection);
					await refresh();
				})
			)
		),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("claudeAccounts")) {
				restartSyncTimer();
				void restarter.follow(() => restoreAccount().then(refresh));
			}
		}),
		// Another window may have switched accounts while this one was in the background.
		vscode.window.onDidChangeWindowState((state) => {
			if (state.focused) {
				void refresh();
			}
		})
	);
	await restoreAccount();
	await syncActiveAccount(accounts);
	await refresh();
	restartSyncTimer();
}

export async function deactivate(): Promise<void> {
	stopSyncTimer();
	if (store) {
		await syncActiveAccount(store);
	}
}

function stopSyncTimer(): void {
	clearInterval(syncTimer);
	syncTimer = undefined;
}
