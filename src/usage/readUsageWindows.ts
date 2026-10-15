export interface UsageWindow {
	kind: "session" | "weekly" | "scoped";
	/** The model or surface a scoped window is limited to, as the API names it. */
	scope?: string;
	/** 0 to 100. */
	percent: number;
	/** Epoch ms, or `undefined` before the window has started. */
	resetsAt?: number;
}

interface LimitEntry {
	kind?: string;
	group?: string;
	percent?: unknown;
	resets_at?: string | null;
	scope?: { model?: { display_name?: string }; surface?: string };
}

interface LegacyLimit {
	utilization?: unknown;
	resets_at?: string | null;
}

interface UsagePayload {
	limits?: LimitEntry[];
	five_hour?: LegacyLimit | null;
	seven_day?: LegacyLimit | null;
	seven_day_opus?: LegacyLimit | null;
	seven_day_sonnet?: LegacyLimit | null;
}

const order: Record<UsageWindow["kind"], number> = { session: 0, weekly: 1, scoped: 2 };

/**
 * Reads the body of `/api/oauth/usage` into windows, session first. The endpoint moved its figures into a
 * `limits` array and left the older per-window fields behind, sometimes as null, so `limits` wins when it says
 * anything and the old fields are only a fallback.
 */
export function readUsageWindows(payload: unknown): UsageWindow[] {
	const usage = (payload ?? {}) as UsagePayload;
	const current = (Array.isArray(usage.limits) ? usage.limits : []).map(fromLimit);
	const windows = current.some(Boolean)
		? current
		: [
				fromLegacy(usage.five_hour, "session"),
				fromLegacy(usage.seven_day, "weekly"),
				fromLegacy(usage.seven_day_opus, "scoped", "Opus"),
				fromLegacy(usage.seven_day_sonnet, "scoped", "Sonnet")
			];
	return windows.filter((window): window is UsageWindow => window !== undefined).sort((a, b) => order[a.kind] - order[b.kind]);
}

function fromLimit(entry: LimitEntry): UsageWindow | undefined {
	const kind = kindOf(entry);
	if (!kind) {
		return undefined;
	}

	const scope = kind === "scoped" ? entry.scope?.model?.display_name || entry.scope?.surface || undefined : undefined;
	return { kind, scope, percent: percentOf(entry.percent), resetsAt: timeOf(entry.resets_at) };
}

/** The `group` has stayed stable while `kind` gained new values, so an unknown kind falls back to it. */
function kindOf(entry: LimitEntry): UsageWindow["kind"] | undefined {
	switch (entry.kind) {
		case "session":
			return "session";
		case "weekly_all":
			return "weekly";
		case "weekly_scoped":
			return "scoped";
		default:
			return entry.group === "session" ? "session" : entry.group === "weekly" ? "scoped" : undefined;
	}
}

function fromLegacy(limit: LegacyLimit | null | undefined, kind: UsageWindow["kind"], scope?: string): UsageWindow | undefined {
	return limit ? { kind, scope, percent: percentOf(limit.utilization), resetsAt: timeOf(limit.resets_at) } : undefined;
}

function percentOf(value: unknown): number {
	const percent = Number(value);
	return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
}

function timeOf(value: string | null | undefined): number | undefined {
	const time = value ? Date.parse(value) : NaN;
	return Number.isNaN(time) ? undefined : time;
}
