import type { UsageWindow } from "./readUsageWindows";
import type { UsageReading } from "./UsageMeter";

export interface UsageDescription {
	/** For the status bar, such as "5h 34% · wk 12%". Empty when nothing is known. */
	summary: string;
	/** One tooltip line per window, or why there are none. */
	lines: string[];
}

export function describeUsage(reading: UsageReading): UsageDescription {
	if (reading === "expired") {
		return { summary: "", lines: ["Usage shows once Claude Code refreshes this login."] };
	}

	if (!reading || reading.length === 0) {
		return { summary: "", lines: ["Usage isn't available right now."] };
	}

	const session = reading.find((window) => window.kind === "session");
	const weekly = reading.find((window) => window.kind === "weekly");
	const summary = [session && `5h ${Math.round(session.percent)}%`, weekly && `wk ${Math.round(weekly.percent)}%`].filter(Boolean).join(" · ");
	// Every scoped cap reads 0% at the start of a week, and one with no use yet can't be the one that binds.
	const lines = reading.filter((window) => window.kind !== "scoped" || window.percent > 0).map(describeWindow);
	return { summary, lines };
}

function describeWindow(window: UsageWindow): string {
	const name = window.kind === "session" ? "5-hour limit" : window.scope ? `Weekly ${window.scope} limit` : "Weekly limit";
	const resets = window.resetsAt === undefined ? "" : `, resets ${new Date(window.resetsAt).toLocaleString(undefined, resetFormat)}`;
	return `${name}: ${Math.round(window.percent)}% used${resets}`;
}

const resetFormat: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit" };
