import { describe, expect, it } from "vitest";
import { readUsageWindows } from "../../src/usage/readUsageWindows";

const monday = "2026-10-19T09:00:00Z";
const tonight = "2026-10-15T23:00:00Z";

describe("readUsageWindows", () => {
	it("reads the limits array, session first, naming scoped caps after their model or surface", () => {
		const windows = readUsageWindows({
			limits: [
				{ kind: "weekly_scoped", group: "weekly", percent: 16, resets_at: monday, scope: { model: { display_name: "Opus" } } },
				{ kind: "weekly_all", group: "weekly", percent: 8, resets_at: monday },
				{ kind: "session", group: "session", percent: 34, resets_at: tonight },
				{ kind: "weekly_scoped", group: "weekly", percent: 2, resets_at: null, scope: { surface: "Claude Code" } }
			],
			five_hour: { utilization: 99, resets_at: tonight }
		});
		expect(windows).toEqual([
			{ kind: "session", scope: undefined, percent: 34, resetsAt: Date.parse(tonight) },
			{ kind: "weekly", scope: undefined, percent: 8, resetsAt: Date.parse(monday) },
			{ kind: "scoped", scope: "Opus", percent: 16, resetsAt: Date.parse(monday) },
			{ kind: "scoped", scope: "Claude Code", percent: 2, resetsAt: undefined }
		]);
	});

	it("files a kind it has never seen under its group, and drops one with neither", () => {
		const windows = readUsageWindows({
			limits: [
				{ kind: "session_v2", group: "session", percent: 5 },
				{ kind: "weekly_team", group: "weekly", percent: 7 },
				{ kind: "monthly", group: "monthly", percent: 9 }
			]
		});
		expect(windows.map(({ kind, percent }) => [kind, percent])).toEqual([
			["session", 5],
			["scoped", 7]
		]);
	});

	it("falls back to the older fields when the limits array says nothing it knows", () => {
		const windows = readUsageWindows({
			limits: [{ kind: "monthly", group: "monthly", percent: 9 }],
			five_hour: { utilization: 3.5, resets_at: tonight },
			seven_day: { utilization: 12, resets_at: monday },
			seven_day_opus: null,
			seven_day_sonnet: { utilization: 1, resets_at: "not a date" }
		});
		expect(windows).toEqual([
			{ kind: "session", scope: undefined, percent: 3.5, resetsAt: Date.parse(tonight) },
			{ kind: "weekly", scope: undefined, percent: 12, resetsAt: Date.parse(monday) },
			{ kind: "scoped", scope: "Sonnet", percent: 1, resetsAt: undefined }
		]);
	});

	it("keeps percentages between 0 and 100 and reads garbage as 0", () => {
		const windows = readUsageWindows({
			limits: [
				{ kind: "session", percent: 140 },
				{ kind: "weekly_all", percent: -3 },
				{ kind: "weekly_scoped", percent: "lots" }
			]
		});
		expect(windows.map((window) => window.percent)).toEqual([100, 0, 0]);
	});

	it.each([[null], ["not an object"], [{}]])("reads %j as no windows", (payload) => {
		expect(readUsageWindows(payload)).toEqual([]);
	});
});
