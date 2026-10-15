import { oauthOf } from "../profiles/oauthOf";
import { oauthTimestampOf } from "../profiles/oauthTimestampOf";
import { readUsageWindows, type UsageWindow } from "./readUsageWindows";
import { requestUsage } from "./requestUsage";

const FRESH_MS = 2 * 60_000;
/** Claude Code and other usage readers share each account's allowance on this endpoint. */
const COOL_DOWN_MS = 5 * 60_000;

/** `"expired"` means the access token has run out and Claude Code has yet to refresh it. `null` means unknown. */
export type UsageReading = UsageWindow[] | "expired" | null;

interface Latest {
	token: string;
	/** Until then, a read for the same token reuses `windows` instead of asking again. */
	until: number;
	windows: Promise<UsageWindow[] | null>;
}

/** Reads the usage of whichever login it is handed, asking Anthropic at most once every two minutes per login. */
export class UsageMeter {
	private latest?: Latest;

	read(credentials: string): Promise<UsageReading> {
		const token = oauthOf(credentials)?.accessToken;
		if (typeof token !== "string") {
			return Promise.resolve(null);
		}

		// Refreshing the token here would race Claude Code, which refreshes it in place, so an expired one waits.
		if ((oauthTimestampOf(credentials, "expiresAt") ?? Infinity) <= Date.now()) {
			return Promise.resolve("expired");
		}

		if (this.latest?.token === token && Date.now() < this.latest.until) {
			return this.latest.windows;
		}

		const previous = this.latest?.token === token ? this.latest.windows : Promise.resolve(null);
		const latest: Latest = { token, until: Date.now() + FRESH_MS, windows: previous };
		latest.windows = this.request(latest, previous);
		this.latest = latest;
		return latest.windows;
	}

	/** A failed refresh keeps the last figures for the same login, which beat showing none. */
	private async request(latest: Latest, previous: Promise<UsageWindow[] | null>): Promise<UsageWindow[] | null> {
		try {
			const { status, body } = await requestUsage(latest.token);
			if (status === 200) {
				return readUsageWindows(JSON.parse(body));
			}

			if (status === 429) {
				latest.until = Date.now() + COOL_DOWN_MS;
			}
		} catch {
			// Unknown usage is shown as unknown, whatever the reason.
		}

		return previous;
	}
}
