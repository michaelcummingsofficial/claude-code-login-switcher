import { describe, expect, it } from "vitest";
import { updateSetting } from "../../src/settings/updateSetting";
import { useSettings } from "../helpers/useSettings";
import { ConfigurationTarget, workspace } from "../mocks/vscode";

describe("updateSetting", () => {
	it("saves to the user settings", async () => {
		const update = useSettings({});
		await updateSetting("showUsage", true);
		expect(workspace.getConfiguration).toHaveBeenCalledWith("claudeAccounts");
		expect(update).toHaveBeenCalledWith("showUsage", true, ConfigurationTarget.Global);
	});

	it("saves to the workspace when the workspace sets its own value, which would hide a user setting", async () => {
		const update = useSettings({}, { showUsage: false });
		await updateSetting("showUsage", true);
		expect(update).toHaveBeenCalledWith("showUsage", true, ConfigurationTarget.Workspace);
	});
});
