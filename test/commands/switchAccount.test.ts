import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { addAccount } from "../../src/commands/addAccount";
import { changeSwitchScope } from "../../src/commands/changeSwitchScope";
import { saveCurrentAccount } from "../../src/commands/saveCurrentAccount";
import { switchAccount } from "../../src/commands/switchAccount";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { QuickPickItemKind, window } from "../mocks/vscode";

vi.mock("../../src/commands/addAccount");
vi.mock("../../src/commands/changeSwitchScope");
vi.mock("../../src/commands/saveCurrentAccount");
vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/useWorkspaceAccount");

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
			{ label: "$(add) Log in to another account" },
			{ label: "$(gear) Applies everywhere", description: "Change" }
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

	it("opens the scope picker from the entry that names the current scope", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		pick("Applies everywhere");
		await switchAccount(store);
		expect(changeSwitchScope).toHaveBeenCalled();
		expect(addAccount).not.toHaveBeenCalled();
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
		expect(window.showInformationMessage).toHaveBeenCalledWith('Switched to "Work". Restart any running Claude session to use it.');
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

	it("confirms the switch once Claude Code itself reports the login", async () => {
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true });
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(window.showInformationMessage).toHaveBeenCalledWith('Switched to "Work". Restart any running Claude session to use it.');
		expect(window.showWarningMessage).not.toHaveBeenCalled();
	});

	it("warns when Claude Code does not see the login after the switch", async () => {
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: false });
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(window.showWarningMessage).toHaveBeenCalledWith('Claude Code does not see a login for "Work". Log in to it again with Add Account.');
		expect(window.showInformationMessage).not.toHaveBeenCalled();
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

	describe("when a switch applies to this workspace only", () => {
		beforeEach(() => {
			useSettings({ switchScope: "workspace" });
		});

		it("moves this window to the picked account and leaves the shared login alone", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			const personal = await store.add({ label: "Personal" }, "personal-tokens");
			live.value = "personal-tokens";
			pick("Work");
			await switchAccount(store);
			expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
			expect(live.value).toBe("personal-tokens");
			expect(window.showInformationMessage).toHaveBeenCalledWith('Switched this workspace to "Work". Open a new terminal or Claude session to use it.');
			redirectConfigDir(undefined);
			await expect(store.activeId()).resolves.toBe(personal.id);
		});

		it("names the scope in the picker", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			await switchAccount(store);
			expect(window.showQuickPick.mock.calls[0]![0].at(-1)).toMatchObject({ label: "$(gear) Applies to this workspace only" });
		});

		it("pins the shared account here when it is picked before the workspace has its own", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			pick("Work");
			await switchAccount(store);
			expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		});

		it("does nothing when the workspace's own account is picked", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			redirectConfigDir(`/accounts/logins/${work.id}`);
			pick("Work");
			await switchAccount(store);
			expect(useWorkspaceAccount).not.toHaveBeenCalled();
		});

		it("reports a failed switch", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			vi.mocked(useWorkspaceAccount).mockRejectedValue(new Error("Windows blocked the links"));
			pick("Work");
			await switchAccount(store);
			expect(window.showErrorMessage).toHaveBeenCalledWith("Could not switch account: Windows blocked the links");
		});
	});
});
