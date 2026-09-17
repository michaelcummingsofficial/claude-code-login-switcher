import { describe, expect, it } from "vitest";
import { pickSavedProfile } from "../../src/profiles/pickSavedProfile";
import { createTempStore } from "../helpers/createTempStore";
import { window } from "../mocks/vscode";

describe("pickSavedProfile", () => {
	it("says so and skips the picker when nothing is saved", async () => {
		await expect(pickSavedProfile(createTempStore(), "Pick")).resolves.toBeUndefined();
		expect(window.showInformationMessage).toHaveBeenCalledWith("No saved Claude accounts.");
		expect(window.showQuickPick).not.toHaveBeenCalled();
	});

	it("lists profiles by label and email and returns the one picked", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work", email: "ada@work.com" }, "work");
		const personal = await store.add({ label: "Personal" }, "personal");
		window.showQuickPick.mockImplementation(async (items) => items[1]);
		await expect(pickSavedProfile(store, "Rename a saved Claude account")).resolves.toEqual(personal);
		expect(window.showQuickPick).toHaveBeenCalledWith(
			[
				{ label: "Work", description: "ada@work.com", profile: work },
				{ label: "Personal", description: undefined, profile: personal }
			],
			{ title: "Rename a saved Claude account" }
		);
	});

	it("returns undefined when the picker is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work");
		await expect(pickSavedProfile(store, "Pick")).resolves.toBeUndefined();
	});
});
