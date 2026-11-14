import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { addAccount } from "../../src/commands/addAccount";
import { changeSwitchScope } from "../../src/commands/changeSwitchScope";
import { logInAgain } from "../../src/commands/logInAgain";
import { saveCurrentAccount } from "../../src/commands/saveCurrentAccount";
import { switchAccount } from "../../src/commands/switchAccount";
import { newestLoginOf } from "../../src/workspace/newestLoginOf";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { QuickPickItemKind, window } from "../mocks/vscode";

vi.mock("../../src/commands/addAccount");
vi.mock("../../src/commands/changeSwitchScope");
vi.mock("../../src/commands/logInAgain");
vi.mock("../../src/commands/saveCurrentAccount");
vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/newestLoginOf");
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

	it("lists accounts with the active one checked, expiring ones flagged, and the login entries", async () => {
		vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
		const store = createTempStore();
		await store.add({ label: "Work", email: "ada@work.com", subscriptionType: "team", refreshTokenExpiresAt: 1_000_000_000_000 }, "work-tokens");
		await store.add({ label: "Studio", refreshTokenExpiresAt: 2_000_000_000_000 + 86_400_000 }, "studio-tokens");
		await store.add({ label: "Personal", subscriptionType: "pro", refreshTokenExpiresAt: 3_000_000_000_000 }, "personal-tokens");
		await switchAccount(store);
		const [items, options] = window.showQuickPick.mock.calls[0]!;
		expect(options).toEqual({ title: "Switch Claude account", placeHolder: "Pick an account" });
		expect(items).toMatchObject([
			{ label: "Work", description: "ada@work.com · team", detail: "Login expired. Pick it to log in again." },
			{ label: "Studio", description: "", detail: "Login expires in 1 day. Log in again to renew it." },
			{ label: "$(check) Personal", description: "pro", detail: undefined },
			{ label: "", kind: QuickPickItemKind.Separator },
			{ label: "$(add) Log in to another account" },
			{ label: "$(refresh) Log in again to a saved account" },
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

	it("starts a login to a saved account from the picker", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		pick("Log in again to a saved account");
		await switchAccount(store);
		expect(logInAgain).toHaveBeenCalledWith(store);
	});

	it("logs in to an expired account when it is picked, instead of switching to a dead login", async () => {
		vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
		const store = createTempStore();
		const work = await store.add({ label: "Work", refreshTokenExpiresAt: 1_000_000_000_000 }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(addAccount).toHaveBeenCalledWith(store, work);
		expect(live.value).toBeNull();
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
		expect(window.showInformationMessage).toHaveBeenCalledWith('Switched to "Work". Restart any Claude session running in a terminal to use it.');
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
		expect(window.showInformationMessage).toHaveBeenCalledWith('Switched to "Work". Restart any Claude session running in a terminal to use it.');
		expect(window.showWarningMessage).not.toHaveBeenCalled();
	});

	it("warns when Claude Code does not see the login after the switch", async () => {
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: false });
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(window.showWarningMessage).toHaveBeenCalledWith('Claude Code does not see a login for "Work".', "Log in again");
		expect(window.showInformationMessage).not.toHaveBeenCalled();
		expect(addAccount).not.toHaveBeenCalled();
	});

	it("logs in to the account again when asked, after Claude Code does not see its login", async () => {
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: false });
		window.showWarningMessage.mockResolvedValue("Log in again");
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		pick("Work");
		await switchAccount(store);
		expect(addAccount).toHaveBeenCalledWith(store, work);
	});

	it("reports missing saved credentials without switching", async () => {
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		vi.spyOn(store, "credentialsFor").mockResolvedValue(null);
		window.showErrorMessage.mockResolvedValue("Log in again");
		pick("Work");
		await switchAccount(store);
		expect(window.showErrorMessage).toHaveBeenCalledWith('The saved login for "Work" is missing.', "Log in again");
		expect(addAccount).toHaveBeenCalledWith(store, expect.objectContaining({ label: "Work" }));
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
			expect(window.showInformationMessage).toHaveBeenCalledWith('Switched this workspace to "Work". Open a new terminal to use it there.');
			redirectConfigDir(undefined);
			await expect(store.activeId()).resolves.toBe(personal.id);
		});

		it("names the scope in the picker", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			await switchAccount(store);
			expect(window.showQuickPick.mock.calls[0]![0].at(-1)).toMatchObject({ label: "$(gear) Applies to this workspace only" });
		});

		it("does nothing when the shared account is picked in a workspace that follows it", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			pick("Work");
			await switchAccount(store);
			expect(useWorkspaceAccount).not.toHaveBeenCalled();
		});

		it("returns a workspace with its own account to the shared one when that is picked", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			const personal = await store.add({ label: "Personal" }, "personal-tokens");
			redirectConfigDir(`/accounts/logins/${work.id}`);
			pick("Personal");
			await switchAccount(store);
			expect(useWorkspaceAccount).toHaveBeenCalledWith(store, personal.id);
		});

		it("says which account workspaces without their own follow", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			await store.add({ label: "Personal" }, "personal-tokens");
			await switchAccount(store);
			expect(window.showQuickPick.mock.calls[0]![0].slice(0, 2)).toMatchObject([
				{ label: "Work", detail: undefined },
				{ label: "$(check) Personal", detail: "Shared by every workspace without its own account." }
			]);
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
			await store.add({ label: "Personal" }, "personal-tokens");
			vi.mocked(useWorkspaceAccount).mockRejectedValue(new Error("Windows blocked the links"));
			pick("Work");
			await switchAccount(store);
			expect(window.showErrorMessage).toHaveBeenCalledWith("Could not switch account: Windows blocked the links");
		});
	});

	describe("signing an account in everywhere", () => {
		beforeEach(() => {
			useSettings({ switchScope: "workspace" });
			vi.mocked(useWorkspaceAccount).mockImplementation(async (_store, id) => {
				if (!id) {
					redirectConfigDir(undefined);
				}
			});
		});

		it("is offered in the picker only when a switch applies to one workspace", async () => {
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			await switchAccount(store);
			useSettings({});
			await switchAccount(store);
			const [scoped, global] = window.showQuickPick.mock.calls.map(([items]) => items.map((item: { label: string }) => item.label));
			expect(scoped).toContain("$(globe) Use an account everywhere");
			expect(global).not.toContain("$(globe) Use an account everywhere");
		});

		it("opens a picker of accounts alone, with the shared login's account checked", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			await store.add({ label: "Personal" }, "personal-tokens");
			redirectConfigDir(`/accounts/logins/${work.id}`);
			window.showQuickPick.mockImplementationOnce(async (items: { label: string }[]) => items.find((item) => item.label.endsWith("everywhere")));
			await switchAccount(store);
			const [items, options] = window.showQuickPick.mock.calls[1]!;
			expect(options).toEqual({ title: "Use a Claude account everywhere", placeHolder: "Pick an account" });
			expect(items.map((item: { label: string }) => item.label)).toEqual(["Work", "$(check) Personal"]);
		});

		it("points this workspace at the account's own login and notes it for every other workspace, copying no tokens", async () => {
			vi.spyOn(Date, "now").mockReturnValue(7000);
			const store = createTempStore();
			await store.add({ label: "Work" }, "work-tokens");
			const personal = await store.add({ label: "Personal" }, "personal-tokens");
			const studio = await store.add({ label: "Studio" }, "studio-tokens");
			await store.setActive(personal.id);
			live.value = "personal-tokens";
			pick("Studio");
			const write = vi.spyOn(live, "write");
			await switchAccount(store, true);
			expect(useWorkspaceAccount).toHaveBeenCalledWith(store, studio.id);
			expect(write).not.toHaveBeenCalled();
			await expect(store.sharedId()).resolves.toBe(personal.id);
			expect(store.snapshot().everywhere).toEqual({ id: studio.id, at: 7000 });
			expect(window.showInformationMessage).toHaveBeenCalledWith('Switched every workspace to "Studio". Open windows follow when you go back to them.');
		});

		it("still notes the account when this workspace already uses it, so the others follow", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			await store.add({ label: "Personal" }, "personal-tokens");
			redirectConfigDir(`/accounts/logins/${work.id}`);
			pick("Work");
			await switchAccount(store, true);
			expect(store.snapshot().everywhere?.id).toBe(work.id);
			expect(useWorkspaceAccount).toHaveBeenCalledWith(store, work.id);
		});

		it("switches the shared login itself when one account applies everywhere, taking a newer login from the account's folder", async () => {
			useSettings({});
			vi.mocked(newestLoginOf).mockResolvedValue("work-refreshed");
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			await store.add({ label: "Personal" }, "personal-tokens");
			pick("Work");
			await switchAccount(store);
			expect(newestLoginOf).toHaveBeenCalledWith(store, work.id);
			expect(live.value).toBe("work-refreshed");
			await expect(store.sharedId()).resolves.toBe(work.id);
			expect(store.snapshot().everywhere).toBeUndefined();
			expect(useWorkspaceAccount).not.toHaveBeenCalled();
		});
	});
});
