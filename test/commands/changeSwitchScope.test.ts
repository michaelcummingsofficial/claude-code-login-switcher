import { describe, expect, it } from "vitest";
import { changeSwitchScope } from "../../src/commands/changeSwitchScope";
import { useSettings } from "../helpers/useSettings";
import { ConfigurationTarget, window } from "../mocks/vscode";

function pick(label: string): void {
	window.showQuickPick.mockImplementation(async (items: { label: string }[]) => items.find((item) => item.label.endsWith(label)));
}

describe("changeSwitchScope", () => {
	it("offers both scopes with the current one checked", async () => {
		useSettings({ switchScope: "workspace" });
		await changeSwitchScope();
		const [items, options] = window.showQuickPick.mock.calls[0]!;
		expect(options).toEqual({ title: "Where a switch applies" });
		expect(items).toMatchObject([
			{ label: "One account everywhere", detail: "A switch changes the login in every workspace and terminal." },
			{
				label: "$(check) One account per workspace",
				detail: "A switch changes this workspace only. History, settings, and MCP servers stay shared."
			}
		]);
	});

	it("saves the picked scope to the user settings", async () => {
		const update = useSettings({});
		pick("One account per workspace");
		await changeSwitchScope();
		expect(update).toHaveBeenCalledWith("switchScope", "workspace", ConfigurationTarget.Global);
	});

	it("saves it for the workspace when the workspace already sets a scope", async () => {
		const update = useSettings({ switchScope: "workspace" }, { switchScope: "workspace" });
		pick("One account everywhere");
		await changeSwitchScope();
		expect(update).toHaveBeenCalledWith("switchScope", "global", ConfigurationTarget.Workspace);
	});

	it.each([
		["the picker is dismissed", undefined],
		["the current scope is picked", "One account everywhere"]
	])("changes nothing when %s", async (_case, label) => {
		const update = useSettings({});
		if (label) {
			pick(label);
		}

		await changeSwitchScope();
		expect(update).not.toHaveBeenCalled();
	});
});
