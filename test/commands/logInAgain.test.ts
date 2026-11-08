import { describe, expect, it, vi } from "vitest";
import { addAccount } from "../../src/commands/addAccount";
import { logInAgain } from "../../src/commands/logInAgain";
import { createTempStore } from "../helpers/createTempStore";
import { window } from "../mocks/vscode";

vi.mock("../../src/commands/addAccount");

describe("logInAgain", () => {
	it("logs in to the account the status bar names without asking", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		await logInAgain(store, personal.id);
		expect(window.showQuickPick).not.toHaveBeenCalled();
		expect(addAccount).toHaveBeenCalledWith(store, personal);
	});

	it("asks which account when run from the Command Palette", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		window.showQuickPick.mockImplementation(async (items: unknown[]) => items[0]);
		await logInAgain(store);
		expect(window.showQuickPick).toHaveBeenCalledWith(expect.any(Array), { title: "Log in again to a saved Claude account" });
		expect(addAccount).toHaveBeenCalledWith(store, work);
	});

	it("does nothing when the picker is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await logInAgain(store, "gone");
		expect(addAccount).not.toHaveBeenCalled();
	});
});
