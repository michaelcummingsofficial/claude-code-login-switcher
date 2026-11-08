import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusBarItem } from "vscode";
import { refreshStatusBar } from "../../src/statusBar/refreshStatusBar";
import { createTempStore } from "../helpers/createTempStore";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { ThemeColor, window } from "../mocks/vscode";

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
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) Claude: signed out");
		expect(statusBar.tooltip).toBe("No Claude Code login found. Run Claude Accounts: Add Account.");
		expect(statusBar.show).toHaveBeenCalled();
	});

	it("shows an unsaved account", async () => {
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, createTempStore());
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) Claude: unsaved");
		expect(statusBar.tooltip).toBe("Signed in, but this account is not saved yet. Run Claude Accounts: Save Current Account.");
	});

	it("shows the active account with its details, and opens the switcher", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000_000_000_000);
		const expiry = 2_000_000_000_000;
		const store = createTempStore();
		await store.add({ label: "Work", email: "ada@work.com", orgName: "Acme", subscriptionType: "team", refreshTokenExpiresAt: expiry }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) Work");
		expect(statusBar.tooltip).toBe(`Work\nada@work.com\nAcme\nplan: team\nlogin valid until ${new Date(expiry).toLocaleString()}`);
		expect(statusBar.command).toBe("claudeAccounts.switch");
		expect(statusBar.backgroundColor).toBeUndefined();
	});

	it("turns yellow when the login is about to expire, and logs in to that account again when clicked", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000_000_000_000);
		const expiry = 1_000_000_000_000 + 2 * 86_400_000;
		const store = createTempStore();
		const work = await store.add({ label: "Work", refreshTokenExpiresAt: expiry }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) $(warning) Work");
		expect(statusBar.tooltip).toBe(`Login expires in 2 days. Click to log in again.\n\nWork\nlogin valid until ${new Date(expiry).toLocaleString()}`);
		expect(statusBar.command).toEqual({ title: "Log In Again", command: "claudeAccounts.logInAgain", arguments: [work.id] });
		expect(statusBar.backgroundColor).toEqual(new ThemeColor("statusBarItem.warningBackground"));
	});

	it("flags an expired login and goes back to the switcher once it is renewed", async () => {
		vi.spyOn(Date, "now").mockReturnValue(3_000_000_000_000);
		const expiry = 2_000_000_000_000;
		const store = createTempStore();
		const personal = await store.add({ label: "Personal", refreshTokenExpiresAt: expiry }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.tooltip).toBe(`Login expired. Click to log in again.\n\nPersonal\nlogin expired ${new Date(expiry).toLocaleString()}`);
		await store.update(personal.id, { refreshTokenExpiresAt: 4_000_000_000_000 });
		await refreshStatusBar(statusBar, store);
		expect(statusBar.command).toBe("claudeAccounts.switch");
		expect(statusBar.backgroundColor).toBeUndefined();
	});

	it("flags the active account when Claude Code has ended its login early", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "tokens");
		useLiveCredential('{"claudeAiOauth":{"accessToken":"","refreshToken":""}}');
		await refreshStatusBar(statusBar, store);
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) $(warning) Work");
	});

	it("shows signed out when Claude Code has ended a login that was never saved", async () => {
		useLiveCredential('{"claudeAiOauth":{"accessToken":"","refreshToken":""}}');
		await refreshStatusBar(statusBar, createTempStore());
		expect(statusBar.text).toBe("$(claude-code-login-switcher-logo) Claude: signed out");
	});

	it("shows just the label when nothing else is known", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "tokens");
		useLiveCredential("tokens");
		await refreshStatusBar(statusBar, store);
		expect(statusBar.tooltip).toBe("Work");
	});
});
