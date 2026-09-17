import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { addAccount } from "../src/commands/addAccount";
import { removeAccount } from "../src/commands/removeAccount";
import { renameAccount } from "../src/commands/renameAccount";
import { saveCurrentAccount } from "../src/commands/saveCurrentAccount";
import { showStatus } from "../src/commands/showStatus";
import { switchAccount } from "../src/commands/switchAccount";
import { activate, deactivate } from "../src/extension";
import { createProfileStore } from "../src/profiles/createProfileStore";
import type { ProfileStore } from "../src/profiles/ProfileStore";
import { syncActiveAccount } from "../src/profiles/syncActiveAccount";
import { refreshStatusBar } from "../src/statusBar/refreshStatusBar";
import { useSettings } from "./helpers/useSettings";
import { commands, StatusBarAlignment, window, workspace } from "./mocks/vscode";

vi.mock("../src/commands/addAccount");
vi.mock("../src/commands/removeAccount");
vi.mock("../src/commands/renameAccount");
vi.mock("../src/commands/saveCurrentAccount");
vi.mock("../src/commands/showStatus");
vi.mock("../src/commands/switchAccount");
vi.mock("../src/profiles/createProfileStore");
vi.mock("../src/profiles/syncActiveAccount");
vi.mock("../src/statusBar/refreshStatusBar");

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
	contributes: { commands: { command: string }[] };
};
const manifestCommandIds = manifest.contributes.commands.map(({ command }) => command).sort();
const handlers = {
	"claudeAccounts.switch": switchAccount,
	"claudeAccounts.saveCurrent": saveCurrentAccount,
	"claudeAccounts.addAccount": addAccount,
	"claudeAccounts.remove": removeAccount,
	"claudeAccounts.rename": renameAccount,
	"claudeAccounts.status": showStatus
};
const store = { path: "/accounts/profiles.json" } as ProfileStore;

async function activateExtension(): Promise<ExtensionContext> {
	const context = { subscriptions: [] as { dispose(): unknown }[] } as unknown as ExtensionContext;
	await activate(context);
	return context;
}

function registeredIds(): string[] {
	return commands.registerCommand.mock.calls.map(([id]) => id as string).sort();
}

function registeredCommand(id: string): () => Promise<void> {
	return commands.registerCommand.mock.calls.find(([registered]) => registered === id)![1];
}

function listenerFor<T>(event: { mock: { calls: unknown[][] } }): (value: T) => void {
	return event.mock.calls[0]![0] as (value: T) => void;
}

describe("extension", () => {
	beforeEach(() => {
		vi.mocked(createProfileStore).mockReturnValue(store);
		vi.mocked(syncActiveAccount).mockResolvedValue();
		vi.mocked(refreshStatusBar).mockResolvedValue();
	});

	afterEach(async () => {
		await deactivate();
		vi.useRealTimers();
	});

	it("creates the account store for this platform from the extension context", async () => {
		const context = await activateExtension();
		expect(createProfileStore).toHaveBeenCalledWith(context);
	});

	describe("once activated", () => {
		it("registers exactly the commands package.json contributes", async () => {
			await activateExtension();
			expect(registeredIds()).toEqual(manifestCommandIds);
		});

		it("adds a status bar item that opens the switcher", async () => {
			const context = await activateExtension();
			const statusBar = window.createStatusBarItem.mock.results[0]!.value;
			expect(window.createStatusBarItem).toHaveBeenCalledWith(StatusBarAlignment.Right, 100);
			expect(statusBar.command).toBe("claudeAccounts.switch");
			expect(context.subscriptions).toContain(statusBar);
		});

		it("syncs and refreshes the status bar on startup", async () => {
			await activateExtension();
			const statusBar = window.createStatusBarItem.mock.results[0]!.value;
			expect(syncActiveAccount).toHaveBeenCalledWith(store);
			expect(refreshStatusBar).toHaveBeenCalledWith(statusBar, store);
		});

		it.each(Object.entries(handlers))("runs %s with the store, then refreshes the status bar", async (id, handler) => {
			await activateExtension();
			vi.mocked(refreshStatusBar).mockClear();
			await registeredCommand(id)();
			expect(handler).toHaveBeenCalledWith(store);
			expect(refreshStatusBar).toHaveBeenCalledTimes(1);
		});

		it("shows a failed command's error and still refreshes", async () => {
			vi.mocked(addAccount).mockRejectedValue(new Error('Could not write Keychain item "x": security failed (1)'));
			await activateExtension();
			vi.mocked(refreshStatusBar).mockClear();
			await registeredCommand("claudeAccounts.addAccount")();
			expect(window.showErrorMessage).toHaveBeenCalledWith('Could not write Keychain item "x": security failed (1)');
			expect(refreshStatusBar).toHaveBeenCalledTimes(1);
		});

		it("syncs on the configured interval and refreshes after each sync", async () => {
			vi.useFakeTimers();
			useSettings({ syncIntervalMinutes: 2 });
			await activateExtension();
			vi.mocked(syncActiveAccount).mockClear();
			vi.mocked(refreshStatusBar).mockClear();
			await vi.advanceTimersByTimeAsync(119_000);
			expect(syncActiveAccount).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1_000);
			expect(syncActiveAccount).toHaveBeenCalledTimes(1);
			expect(refreshStatusBar).toHaveBeenCalledTimes(1);
		});

		it("starts no timer when the interval is 0", async () => {
			vi.useFakeTimers();
			useSettings({ syncIntervalMinutes: 0 });
			await activateExtension();
			expect(vi.getTimerCount()).toBe(0);
		});

		it("restarts the timer and refreshes when a claudeAccounts setting changes", async () => {
			vi.useFakeTimers();
			await activateExtension();
			vi.mocked(syncActiveAccount).mockClear();
			vi.mocked(refreshStatusBar).mockClear();
			useSettings({ syncIntervalMinutes: 1 });
			listenerFor<{ affectsConfiguration(section: string): boolean }>(workspace.onDidChangeConfiguration)({
				affectsConfiguration: (section) => section === "claudeAccounts"
			});
			expect(refreshStatusBar).toHaveBeenCalledTimes(1);
			expect(vi.getTimerCount()).toBe(1);
			await vi.advanceTimersByTimeAsync(60_000);
			expect(syncActiveAccount).toHaveBeenCalledTimes(1);
		});

		it("ignores changes to other settings", async () => {
			await activateExtension();
			vi.mocked(refreshStatusBar).mockClear();
			listenerFor<{ affectsConfiguration(section: string): boolean }>(workspace.onDidChangeConfiguration)({ affectsConfiguration: () => false });
			expect(refreshStatusBar).not.toHaveBeenCalled();
		});

		it("refreshes when the window gains focus, in case another window switched accounts", async () => {
			await activateExtension();
			vi.mocked(refreshStatusBar).mockClear();
			const onWindowState = listenerFor<{ focused: boolean }>(window.onDidChangeWindowState);
			onWindowState({ focused: false });
			expect(refreshStatusBar).not.toHaveBeenCalled();
			onWindowState({ focused: true });
			expect(refreshStatusBar).toHaveBeenCalledTimes(1);
		});

		it("stops the timer when its subscriptions are disposed", async () => {
			vi.useFakeTimers();
			const context = await activateExtension();
			expect(vi.getTimerCount()).toBe(1);
			for (const subscription of context.subscriptions) {
				subscription.dispose();
			}

			expect(vi.getTimerCount()).toBe(0);
		});

		it("stops the timer and runs a final sync on deactivate", async () => {
			vi.useFakeTimers();
			await activateExtension();
			vi.mocked(syncActiveAccount).mockClear();
			await deactivate();
			expect(vi.getTimerCount()).toBe(0);
			expect(syncActiveAccount).toHaveBeenCalledTimes(1);
		});
	});

	it("does not sync on deactivate when it never activated", async () => {
		vi.resetModules();
		const fresh = await import("../src/extension");
		const freshSync = (await import("../src/profiles/syncActiveAccount")).syncActiveAccount;
		await fresh.deactivate();
		expect(freshSync).not.toHaveBeenCalled();
	});
});
