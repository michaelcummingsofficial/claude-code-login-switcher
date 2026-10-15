import * as vscode from "vscode";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";
import { describeUsage } from "../usage/describeUsage";
import { UsageMeter } from "../usage/UsageMeter";

const REFRESH_MS = 2 * 60_000;
/** Claude Code refreshes an expired token on its next request, which usually comes soon after a switch. */
const EXPIRED_RETRY_MS = 15_000;

/** The usage of this window's login, in a status bar item of its own beside the account. */
export class UsageStatusItem implements vscode.Disposable {
	private readonly item = vscode.window.createStatusBarItem("claudeAccounts.usage", vscode.StatusBarAlignment.Right, 99);
	private readonly meter = new UsageMeter();
	private next?: NodeJS.Timeout;
	private disposed = false;

	constructor(private readonly store: ProfileStore) {
		this.item.name = "Claude Usage";
	}

	async refresh(): Promise<void> {
		clearTimeout(this.next);
		const settings = getSettings();
		const live = settings.showStatusBar && settings.showUsage ? await (await resolveLiveCredential()).read() : null;
		if (live === null) {
			this.item.hide();
			return;
		}

		const [reading, active] = await Promise.all([this.meter.read(live), this.store.active()]);
		// A refresh still running at dispose would otherwise start a timer nothing clears.
		if (this.disposed) {
			return;
		}

		const usage = describeUsage(reading);
		this.item.text = `$(dashboard) ${usage.summary || "—"}`;
		this.item.tooltip = [`Claude usage for ${active?.label ?? "this login"}`, ...usage.lines].join("\n");
		this.item.show();
		clearTimeout(this.next);
		// A window in the background catches up when it gains focus.
		this.next = setTimeout(
			() => {
				if (vscode.window.state.focused) {
					void this.refresh();
				}
			},
			reading === "expired" ? EXPIRED_RETRY_MS : REFRESH_MS
		);
	}

	dispose(): void {
		this.disposed = true;
		clearTimeout(this.next);
		this.item.dispose();
	}
}
