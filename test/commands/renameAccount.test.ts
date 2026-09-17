import { describe, expect, it } from "vitest";
import { renameAccount } from "../../src/commands/renameAccount";
import { createTempStore } from "../helpers/createTempStore";
import { window } from "../mocks/vscode";

describe("renameAccount", () => {
	it("does nothing when the picker is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await renameAccount(store);
		expect(window.showInputBox).not.toHaveBeenCalled();
	});

	it("keeps the name when the input box is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		window.showQuickPick.mockImplementation(async (items) => items[0]);
		await renameAccount(store);
		expect(window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ title: "Rename account", value: "Work" }));
		await expect(store.list()).resolves.toMatchObject([{ label: "Work" }]);
	});

	it("renames the picked account", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		window.showQuickPick.mockImplementation(async (items) => items[0]);
		window.showInputBox.mockResolvedValue(" Work (Max) ");
		await renameAccount(store);
		await expect(store.list()).resolves.toMatchObject([{ label: "Work (Max)" }]);
	});
});
