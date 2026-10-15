import { describe, expect, it } from "vitest";
import { toggleUsage } from "../../src/commands/toggleUsage";
import { useSettings } from "../helpers/useSettings";
import { ConfigurationTarget } from "../mocks/vscode";

describe("toggleUsage", () => {
	it.each([
		["shows usage while it is hidden", false, true],
		["hides usage while it is shown", true, false]
	])("%s", async (_case, shown, next) => {
		const update = useSettings({ showUsage: shown });
		await toggleUsage();
		expect(update).toHaveBeenCalledWith("showUsage", next, ConfigurationTarget.Global);
	});
});
