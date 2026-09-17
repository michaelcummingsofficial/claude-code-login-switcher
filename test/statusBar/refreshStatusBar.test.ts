import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusBarItem } from "vscode";
import { refreshStatusBar } from "../../src/statusBar/refreshStatusBar";
import { createTempStore } from "../helpers/createTempStore";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { window } from "../mocks/vscode";

vi.mock("../../src/credentials/resolveLiveCredential");

let statusBar: StatusBarItem;

describe("refreshStatusBar", () => {
	beforeEach(() => {
		statusBar = window.createStatusBarItem() as StatusBarItem;
	});

	it("hides the item when the setting is off", async () => {
		useSettings({ showStatusBar: false });
		await refreshStatusBar(statusBar, createTempStore());
		expect(statusBar.hide).toHaveBeenCalled();
		expect(statusBar.show).not.toHaveBeenCalled();
	});

	it("shows signed out when there is no live login", async () => {
		useLiveCredential(null);
		await refreshStatusBar(statusBar, createTempStore());
		expect(statusBar.text).toBe("$(claude-account-switcher-logo) Claude: signed out");
		expect(statusBar.tooltip).toBe("No Claude Code login found. Run Claude Accounts: Add Account.");
		expect(statusBar.show).toHaveBeenCalled();
	});

	it("shows an unsaved account", async () => {
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, createTempStore());
		expect(statusBar.text).toBe("$(claude-account-switcher-logo) Claude: unsaved");
		expect(statusBar.tooltip).toBe("Signed in, but this account is not saved yet. Run Claude Accounts: Save Current Account.");
	});

	it("shows the active account with its details", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000_000_000_000);
		const expiry = 2_000_000_000_000;
		const store = createTempStore();
		await store.add({ label: "Work", email: "ada@work.com", orgName: "Acme", subscriptionType: "team", refreshTokenExpiresAt: expiry }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.text).toBe("$(claude-account-switcher-logo) Work");
		expect(statusBar.tooltip).toBe(`Work\nada@work.com\nAcme\nplan: team\nvalid until ${new Date(expiry).toLocaleString()}`);
	});

	it("flags an expired refresh token and omits missing details", async () => {
		vi.spyOn(Date, "now").mockReturnValue(3_000_000_000_000);
		const expiry = 2_000_000_000_000;
		const store = createTempStore();
		await store.add({ label: "Personal", refreshTokenExpiresAt: expiry }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.tooltip).toBe(`Personal\nexpired ${new Date(expiry).toLocaleString()}`);
	});

	it("shows just the label when nothing else is known", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.tooltip).toBe("Work");
	});
});
