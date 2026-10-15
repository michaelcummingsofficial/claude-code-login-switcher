import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { UsageStatusItem } from "../../src/statusBar/UsageStatusItem";
import { UsageMeter } from "../../src/usage/UsageMeter";
import { createTempStore } from "../helpers/createTempStore";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { StatusBarAlignment, window } from "../mocks/vscode";

vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/usage/UsageMeter");

interface FakeItem {
	text: string;
	tooltip: string;
	name?: string;
	show: () => void;
	hide: () => void;
	dispose: () => void;
}

/** Disposed when the test ends, so a refresh still running can't reach into the next test. */
function createUsageItem(store = createTempStore()): UsageStatusItem {
	const usage = new UsageStatusItem(store);
	onTestFinished(() => usage.dispose());
	return usage;
}

function itemOf(): FakeItem {
	return window.createStatusBarItem.mock.results.at(-1)!.value as FakeItem;
}

describe("UsageStatusItem", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useSettings({ showUsage: true });
		useLiveCredential("work-tokens");
		vi.mocked(UsageMeter.prototype.read).mockResolvedValue([
			{ kind: "session", percent: 34 },
			{ kind: "weekly", percent: 12 }
		]);
	});

	afterEach(() => {
		window.state.focused = true;
		vi.useRealTimers();
	});

	it("sits right of the account item, in an item of its own the status bar menu can hide", () => {
		createUsageItem();
		expect(window.createStatusBarItem).toHaveBeenCalledWith("claudeAccounts.usage", StatusBarAlignment.Right, 99);
		expect(itemOf().name).toBe("Claude Usage");
	});

	it("shows the live login's usage, named after the account in use", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const usage = createUsageItem(store);
		await usage.refresh();
		expect(UsageMeter.prototype.read).toHaveBeenCalledWith("work-tokens");
		expect(itemOf()).toMatchObject({
			text: "$(dashboard) 5h 34% · wk 12%",
			tooltip: "Claude usage for Work\n5-hour limit: 34% used\nWeekly limit: 12% used"
		});
		expect(itemOf().show).toHaveBeenCalled();
	});

	it("shows a dash and the reason when the usage is unknown, for a login that isn't saved", async () => {
		vi.mocked(UsageMeter.prototype.read).mockResolvedValue(null);
		await createUsageItem().refresh();
		expect(itemOf()).toMatchObject({ text: "$(dashboard) —", tooltip: "Claude usage for this login\nUsage isn't available right now." });
	});

	it.each([
		["usage is off", { showUsage: false }, "work-tokens"],
		["the status bar is off", { showUsage: true, showStatusBar: false }, "work-tokens"],
		["nobody is signed in", { showUsage: true }, null]
	])("hides itself when %s", async (_case, settings, live) => {
		useSettings(settings);
		useLiveCredential(live);
		const usage = createUsageItem();
		await usage.refresh();
		expect(itemOf().hide).toHaveBeenCalled();
		expect(UsageMeter.prototype.read).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(UsageMeter.prototype.read).not.toHaveBeenCalled();
	});

	it("refreshes every two minutes while the window has focus, and waits for focus otherwise", async () => {
		const usage = createUsageItem();
		await usage.refresh();
		await vi.advanceTimersByTimeAsync(120_000);
		await vi.waitFor(() => expect(itemOf().show).toHaveBeenCalledTimes(2));
		expect(UsageMeter.prototype.read).toHaveBeenCalledTimes(2);
		window.state.focused = false;
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(UsageMeter.prototype.read).toHaveBeenCalledTimes(2);
	});

	it("checks again after 15 seconds while Claude Code has yet to refresh an expired token", async () => {
		vi.mocked(UsageMeter.prototype.read).mockResolvedValue("expired");
		const usage = createUsageItem();
		await usage.refresh();
		expect(itemOf().tooltip).toBe("Claude usage for this login\nUsage shows once Claude Code refreshes this login.");
		await vi.advanceTimersByTimeAsync(15_000);
		expect(UsageMeter.prototype.read).toHaveBeenCalledTimes(2);
	});

	it("keeps one timer when refreshes overlap", async () => {
		const usage = createUsageItem();
		await Promise.all([usage.refresh(), usage.refresh()]);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(UsageMeter.prototype.read).toHaveBeenCalledTimes(3);
	});

	it("stops its timer and removes the item when disposed", async () => {
		const usage = createUsageItem();
		await usage.refresh();
		usage.dispose();
		expect(itemOf().dispose).toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("starts no timer for a refresh that finishes after it was disposed", async () => {
		const usage = createUsageItem();
		const refreshing = usage.refresh();
		usage.dispose();
		await refreshing;
		expect(vi.getTimerCount()).toBe(0);
		expect(itemOf().show).not.toHaveBeenCalled();
	});
});
