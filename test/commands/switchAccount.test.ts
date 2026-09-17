import { beforeEach, describe, expect, it, vi } from "vitest";
import { addAccount } from "../../src/commands/addAccount";
import { saveCurrentAccount } from "../../src/commands/saveCurrentAccount";
import { showStatus } from "../../src/commands/showStatus";
import { switchAccount } from "../../src/commands/switchAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { QuickPickItemKind, window } from "../mocks/vscode";

vi.mock("../../src/commands/addAccount");
vi.mock("../../src/commands/saveCurrentAccount");
vi.mock("../../src/commands/showStatus");
vi.mock("../../src/credentials/resolveLiveCredential");

let live: FakeLiveCredential;

function pick(label: string): void {
	window.showQuickPick.mockImplementation(async (items: { label: string }[]) => items.find((item) => item.label.endsWith(label)));
}

describe("switchAccount", () => {
	beforeEach(() => {
		live = useLiveCredential(null);
	});

	describe("with no saved accounts", () => {
		it.each([
			["Save current account", saveCurrentAccount],
			["Log in to another account", addAccount]
		])("offers to %s", async (choice, command) => {
			const store = createTempStore();
			window.showInformationMessage.mockResolvedValue(choice);
			await switchAccount(store);
			expect(window.showInformationMessage).toHaveBeenCalledWith("No Claude accounts saved yet.", "Save current account", "Log in to another account");
			expect(command).toHaveBeenCalledWith(store);
			expect(window.showQuickPick).not.toHaveBeenCalled();
		});

		it("does nothing when the offer is dismissed", async () => {
			await switchAccount(createTempStore());
			expect(saveCurrentAccount).not.toHaveBeenCalled();
			expect(addAccount).not.toHaveBeenCalled();
		});
	});

	it("lists accounts with the active one checked, expired ones flagged, and a login entry", async () => {
		vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
		const store = createTempStore();
		await store.add({ label: "Work", email: "ada@work.com", subscriptionType: "team", refreshTokenExpiresAt: 1_000_000_000_000 }, "work-tokens");
		await store.add({ label: "Personal", subscriptionType: "pro", refreshTokenExpiresAt: 3_000_000_000_000 }, "personal-tokens");
		await switchAccount(store);
		const [items, options] = window.showQuickPick.mock.calls[0]!;
		expect(options).toEqual({ title: "Switch Claude account", placeHolder: "Pick an account" });
		expect(items).toMatchObject([
			{ label: "Work", description: "ada@work.com · team", detail: "Refresh token expired. Log in again to use this account." },
			{ label: "$(check) Personal", description: "pro", detail: undefined },
			{ label: "", kind: QuickPickItemKind.Separator },
			{ label: "$(add) Log in to another account" }
		]);
	});

	it("does nothing when the picker is dismissed", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await switchAccount(store);
		expect(addAccount).not.toHaveBeenCalled();
	});

	it("starts a login from the picker", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		pick("Log in to another account");
		await switchAccount(store);
		expect(addAccount).toHaveBeenCalledWith(store);
	});

	it("leaves the live login alone when the active account is picked", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		pick("Work");
		const write = vi.spyOn(live, "write");
		await switchAccount(store);
		expect(write).not.toHaveBeenCalled();
	});

	it("makes the picked account live and active", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(live.value).toBe("work-tokens");
		await expect(store.activeId()).resolves.toBe(work.id);
		expect(window.showInformationMessage).toHaveBeenCalledWith('Switched to "Work". Restart any running Claude session to use it.', "Verify");
	});

	it("saves the outgoing account's rotated tokens before switching away", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		live.value = "personal-rotated";
		pick("Work");
		await switchAccount(store);
		await expect(store.credentialsFor(personal.id)).resolves.toBe("personal-rotated");
		expect(live.value).toBe("work-tokens");
	});

	it("does not wait on the confirmation, and verifies when asked", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		let answer: (choice: string) => void = () => undefined;
		window.showInformationMessage.mockReturnValue(new Promise((resolve) => (answer = resolve)));
		await switchAccount(store);
		expect(showStatus).not.toHaveBeenCalled();
		answer("Verify");
		await vi.waitFor(() => expect(showStatus).toHaveBeenCalledWith(store));
	});

	it("reports missing saved credentials without switching", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		vi.spyOn(store, "credentialsFor").mockResolvedValue(null);
		pick("Work");
		await switchAccount(store);
		expect(window.showErrorMessage).toHaveBeenCalledWith('Stored credentials for "Work" are missing. Log in again to re-save it.');
		await expect(store.activeId()).resolves.toBe(personal.id);
	});

	it("reports a failed write without switching", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		vi.spyOn(live, "write").mockRejectedValue(new Error('Could not write Keychain item "Claude Code-credentials": security failed (1)'));
		await switchAccount(store);
		expect(window.showErrorMessage).toHaveBeenCalledWith(
			'Could not switch account: Could not write Keychain item "Claude Code-credentials": security failed (1)'
		);
		await expect(store.activeId()).resolves.toBe(personal.id);
	});
});
