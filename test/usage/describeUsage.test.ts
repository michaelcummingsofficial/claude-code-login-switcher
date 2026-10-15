import { describe, expect, it } from "vitest";
import { describeUsage } from "../../src/usage/describeUsage";

const reset = Date.parse("2026-10-15T23:00:00Z");
const at = (time: number) => new Date(time).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

describe("describeUsage", () => {
	it("sums up the session and weekly limits, and lists every limit with its reset", () => {
		expect(
			describeUsage([
				{ kind: "session", percent: 34.4, resetsAt: reset },
				{ kind: "weekly", percent: 12, resetsAt: reset },
				{ kind: "scoped", scope: "Opus", percent: 20.6, resetsAt: reset }
			])
		).toEqual({
			summary: "5h 34% · wk 12%",
			lines: [
				`5-hour limit: 34% used, resets ${at(reset)}`,
				`Weekly limit: 12% used, resets ${at(reset)}`,
				`Weekly Opus limit: 21% used, resets ${at(reset)}`
			]
		});
	});

	it("leaves out scoped caps nobody has used yet, and resets that haven't started", () => {
		expect(
			describeUsage([
				{ kind: "session", percent: 0 },
				{ kind: "scoped", scope: "Opus", percent: 0, resetsAt: reset },
				{ kind: "scoped", percent: 4 }
			])
		).toEqual({ summary: "5h 0%", lines: ["5-hour limit: 0% used", "Weekly limit: 4% used"] });
	});

	it("says usage is waiting on Claude Code while the token is expired", () => {
		expect(describeUsage("expired")).toEqual({ summary: "", lines: ["Usage shows once Claude Code refreshes this login."] });
	});

	it.each([[null], [[]]])("says usage isn't available for %j", (windows) => {
		expect(describeUsage(windows)).toEqual({ summary: "", lines: ["Usage isn't available right now."] });
	});
});
