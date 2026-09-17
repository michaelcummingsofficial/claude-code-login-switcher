import { describe, expect, it, vi } from "vitest";
import { removeAccount } from "../../src/commands/removeAccount";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { createTempStore } from "../helpers/createTempStore";
import { window } from "../mocks/vscode";

vi.mock("../../src/credentials/resolveLiveCredential");

describe("removeAccount", () => {
	it("does nothing when the picker is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await removeAccount(store);
		expect(window.showWarningMessage).not.toHaveBeenCalled();
		await expect(store.list()).resolves.toHaveLength(1);
	});

	it("keeps the account unless removal is confirmed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		window.showQuickPick.mockImplementation(async (items) => items[0]);
		await removeAccount(store);
		expect(window.showWarningMessage).toHaveBeenCalledWith(
			'Remove "Work"? Its saved tokens are deleted. The live login is not touched.',
			{ modal: true },
			"Remove"
		);
		await expect(store.list()).resolves.toHaveLength(1);
	});

	it("removes the account and its saved tokens, leaving the live login", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		window.showQuickPick.mockImplementation(async (items) => items[0]);
		window.showWarningMessage.mockResolvedValue("Remove");
		await removeAccount(store);
		await expect(store.list()).resolves.toEqual([]);
		await expect(store.credentialsFor(work.id)).resolves.toBeNull();
		expect(resolveLiveCredential).not.toHaveBeenCalled();
	});
});
