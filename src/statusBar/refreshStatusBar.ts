import * as vscode from "vscode";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { isLoginEnded } from "../profiles/isLoginEnded";
import { loginWarningOf } from "../profiles/loginWarningOf";
import type { Profile, ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";

/** The two-person logo from assets/logo.woff, contributed under `contributes.icons` in package.json. */
const LOGO = "$(claude-code-login-switcher-logo)";

export async function refreshStatusBar(statusBar: vscode.StatusBarItem, store: ProfileStore): Promise<void> {
	if (!getSettings().showStatusBar) {
		statusBar.hide();
		return;
	}

	const active = await store.active();
	const live = await (await resolveLiveCredential()).read();
	const warning = active && loginWarningOf(active, live);
	statusBar.command = "claudeAccounts.switch";
	statusBar.backgroundColor = undefined;
	if (active && warning) {
		statusBar.text = `${LOGO} $(warning) ${active.label}`;
		statusBar.tooltip = `${warning.message} Click to log in again.\n\n${describeProfile(active)}`;
		statusBar.command = { title: "Log In Again", command: "claudeAccounts.logInAgain", arguments: [active.id] };
		statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
	} else if (live === null || isLoginEnded(live)) {
		statusBar.text = `${LOGO} Claude: signed out`;
		statusBar.tooltip = "No Claude Code login found. Run Claude Accounts: Add Account.";
	} else if (active) {
		statusBar.text = `${LOGO} ${active.label}`;
		statusBar.tooltip = describeProfile(active);
	} else {
		statusBar.text = `${LOGO} Claude: unsaved`;
		statusBar.tooltip = "Signed in, but this account is not saved yet. Run Claude Accounts: Save Current Account.";
	}

	statusBar.show();
}

function describeProfile(profile: Profile): string {
	const lines = [profile.label, profile.email, profile.orgName, profile.subscriptionType && `plan: ${profile.subscriptionType}`];
	if (profile.refreshTokenExpiresAt) {
		const expiry = new Date(profile.refreshTokenExpiresAt);
		lines.push(expiry.getTime() < Date.now() ? `login expired ${expiry.toLocaleString()}` : `login valid until ${expiry.toLocaleString()}`);
	}

	return lines.filter(Boolean).join("\n");
}
