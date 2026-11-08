import * as vscode from "vscode";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { isLaterLogin } from "../profiles/isLaterLogin";
import { isLoginEnded } from "../profiles/isLoginEnded";
import { refreshTokenExpiryOf } from "../profiles/refreshTokenExpiryOf";

const POLL_MS = 1500;
/** The CLI writes the tokens before the account details `claude auth status` reports, so it gets a moment to exit. */
const EXIT_GRACE_MS = 3000;

/**
 * Shows a notification with a spinner until a new login lands where `claude auth login` writes. `before` is the
 * login that was there when it started. Resolves `false` when the person cancels, or the terminal closes first.
 */
export async function waitForLogin(terminal: vscode.Terminal, before: string | null, title: string): Promise<boolean> {
	return vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title, cancellable: true },
		(_progress, token) =>
			new Promise<boolean>((resolve) => {
				let settled = false;
				let timer: NodeJS.Timeout | undefined;
				const listeners: vscode.Disposable[] = [];
				const finish = (loggedIn: boolean) => {
					if (settled) {
						return;
					}

					settled = true;
					clearTimeout(timer);
					listeners.forEach((listener) => listener.dispose());
					resolve(loggedIn);
				};

				const poll = async () => {
					const login = await readLogin();
					if (settled) {
						return;
					}

					timer = isNewLogin(before, login, false) ? setTimeout(() => finish(true), EXIT_GRACE_MS) : setTimeout(() => void poll(), POLL_MS);
				};

				listeners.push(
					token.onCancellationRequested(() => {
						terminal.dispose();
						finish(false);
					}),
					vscode.window.onDidCloseTerminal((closed) => {
						if (closed === terminal) {
							void readLogin().then((login) => finish(isNewLogin(before, login, true)));
						}
					})
				);
				timer = setTimeout(() => void poll(), POLL_MS);
			})
	);
}

/** A Keychain read that fails is tried again on the next tick. */
async function readLogin(): Promise<string | null> {
	try {
		return await (await resolveLiveCredential()).read();
	} catch {
		return null;
	}
}

/** Claude Code refreshes the old login in place, so only a later sign-in, or one where there was none, is new. */
function isNewLogin(before: string | null, login: string | null, exited: boolean): boolean {
	if (login === null || login === before || isLoginEnded(login)) {
		return false;
	}

	if (before === null || isLoginEnded(before) || isLaterLogin(login, before)) {
		return true;
	}

	// Without expiries to compare, only the CLI exiting tells a new login from a refresh of the old one.
	return exited && (refreshTokenExpiryOf(login) === undefined || refreshTokenExpiryOf(before) === undefined);
}
