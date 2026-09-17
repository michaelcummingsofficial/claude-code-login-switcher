import * as vscode from "vscode";
import { addAccount } from "./commands/addAccount";
import { removeAccount } from "./commands/removeAccount";
import { renameAccount } from "./commands/renameAccount";
import { saveCurrentAccount } from "./commands/saveCurrentAccount";
import { showStatus } from "./commands/showStatus";
import { switchAccount } from "./commands/switchAccount";
import { createProfileStore } from "./profiles/createProfileStore";
import type { ProfileStore } from "./profiles/ProfileStore";
import { syncActiveAccount } from "./profiles/syncActiveAccount";
import { getSettings } from "./settings/getSettings";
import { refreshStatusBar } from "./statusBar/refreshStatusBar";

const commands: Record<string, (store: ProfileStore) => Promise<unknown>> = {
	"claudeAccounts.switch": switchAccount,
	"claudeAccounts.saveCurrent": saveCurrentAccount,
	"claudeAccounts.addAccount": addAccount,
	"claudeAccounts.remove": removeAccount,
	"claudeAccounts.rename": renameAccount,
	"claudeAccounts.status": showStatus
};

let store: ProfileStore | undefined;
let syncTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const accounts = createProfileStore(context);
	store = accounts;
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = "claudeAccounts.switch";
	const refresh = () => refreshStatusBar(statusBar, accounts);
	const restartSyncTimer = () => {
		stopSyncTimer();
		const minutes = getSettings().syncIntervalMinutes;
		if (minutes > 0) {
			syncTimer = setInterval(() => void syncActiveAccount(accounts).then(refresh), minutes * 60_000);
		}
	};

	context.subscriptions.push(
		statusBar,
		{ dispose: stopSyncTimer },
		...Object.entries(commands).map(([id, command]) =>
			vscode.commands.registerCommand(id, async () => {
				try {
					await command(accounts);
				} catch (error) {
					void vscode.window.showErrorMessage((error as Error).message);
				}

				await refresh();
			})
		),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("claudeAccounts")) {
				restartSyncTimer();
				void refresh();
			}
		}),
		// Another window may have switched accounts while this one was in the background.
		vscode.window.onDidChangeWindowState((state) => {
			if (state.focused) {
				void refresh();
			}
		})
	);
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
