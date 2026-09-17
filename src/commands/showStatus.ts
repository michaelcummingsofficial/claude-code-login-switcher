import * as vscode from "vscode";
import { type AuthStatus, readAuthStatus } from "../claude/readAuthStatus";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import type { ProfileStore } from "../profiles/ProfileStore";
import { syncActiveAccount } from "../profiles/syncActiveAccount";
import { getSettings } from "../settings/getSettings";

export async function showStatus(store: ProfileStore): Promise<void> {
	await syncActiveAccount(store);
	const status = await readAuthStatus(getSettings().claudePath);
	const active = await store.active();
	const lines = [
		`Live login: ${(await resolveLiveCredential()).location}`,
		`Saved accounts: ${(await store.list()).length} (${store.path})`,
		`Active saved account: ${active ? active.label : "none"}`,
		`claude auth status: ${describeAuthStatus(status)}`
	];
	void vscode.window.showInformationMessage(lines.join("\n"), { modal: true });
}

function describeAuthStatus(status: AuthStatus | null): string {
	if (!status) {
		return "could not run the CLI";
	}

	if (!status.loggedIn) {
		return "signed out";
	}

	return `${status.email ?? "signed in"} (${status.subscriptionType ?? status.authMethod ?? "unknown plan"})`;
}
