import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClaudePath } from "../../src/claude/resolveClaudePath";
import { addAccount } from "../../src/commands/addAccount";
import { syncActiveAccount } from "../../src/profiles/syncActiveAccount";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { removeLoginDir } from "../../src/workspace/removeLoginDir";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { usePlatform } from "../helpers/usePlatform";
import { useSettings } from "../helpers/useSettings";
import { window } from "../mocks/vscode";

vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/claude/resolveClaudePath");
vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/removeLoginDir");
vi.mock("../../src/workspace/useWorkspaceAccount");

const FINISHED = "I finished logging in";

let live: FakeLiveCredential;
let terminal: { show: ReturnType<typeof vi.fn> };

/** Simulates `claude auth login` replacing the live login while the "finished" prompt is open. */
function loginAs(tokens: string, answer: string | undefined): void {
	window.showInformationMessage.mockImplementation(async (message: string) => {
		if (message.startsWith("Finish the login")) {
			live.value = tokens;
			return answer;
		}

		return undefined;
	});
}

describe("addAccount", () => {
	beforeEach(() => {
		live = useLiveCredential(null);
		vi.mocked(resolveClaudePath).mockReturnValue("/opt/homebrew/bin/claude");
		terminal = { show: vi.fn() };
		window.createTerminal.mockReturnValue(terminal);
	});

	it("runs `claude auth login` in a terminal, then saves the new account", async () => {
		usePlatform("darwin");
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		live.value = "work-tokens";
		loginAs("personal-tokens", FINISHED);
		window.showInputBox.mockResolvedValue("Personal");
		await addAccount(store);
		expect(window.showWarningMessage).not.toHaveBeenCalled();
		expect(window.createTerminal).toHaveBeenCalledWith({ name: "Claude login", shellPath: "/opt/homebrew/bin/claude", shellArgs: ["auth", "login"] });
		expect(terminal.show).toHaveBeenCalled();
		expect(window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("Finish the login"), { modal: true }, FINISHED);
		const personal = await store.active();
		expect(personal).toMatchObject({ label: "Personal" });
		await expect(store.credentialsFor(personal!.id)).resolves.toBe("personal-tokens");
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
	});

	it("starts npm's claude.cmd through cmd.exe on Windows", async () => {
		usePlatform("win32");
		vi.stubEnv("ComSpec", "C:\\Windows\\system32\\cmd.exe");
		vi.mocked(resolveClaudePath).mockReturnValue("C:\\Users\\Ada Lovelace\\AppData\\Roaming\\npm\\claude.cmd");
		await addAccount(createTempStore());
		expect(window.createTerminal).toHaveBeenCalledWith({
			name: "Claude login",
			shellPath: "C:\\Windows\\system32\\cmd.exe",
			shellArgs: '/d /s /c ""C:\\Users\\Ada Lovelace\\AppData\\Roaming\\npm\\claude.cmd" auth login"'
		});
	});

	it("banks rotated tokens for the active account before logging in", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		live.value = "work-rotated";
		await addAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-rotated");
	});

	it("keeps a sync during the login from overwriting the previous account", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		live.value = "work-tokens";
		window.showInformationMessage.mockImplementation(async () => {
			live.value = "personal-tokens";
			await syncActiveAccount(store);
			return undefined;
		});
		await addAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
		await expect(store.activeId()).resolves.toBeNull();
	});

	it("does not save when the login prompt is dismissed", async () => {
		const store = createTempStore();
		loginAs("personal-tokens", undefined);
		await addAccount(store);
		await expect(store.list()).resolves.toEqual([]);
		expect(window.showInputBox).not.toHaveBeenCalled();
	});

	it("shows an error and leaves the active account alone when the CLI is missing", async () => {
		vi.mocked(resolveClaudePath).mockReturnValue(null);
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await addAccount(store);
		expect(window.showErrorMessage).toHaveBeenCalledWith("Could not find the claude CLI. Set claudeAccounts.claudePath to its full path.");
		expect(window.createTerminal).not.toHaveBeenCalled();
		await expect(store.activeId()).resolves.toBe(work.id);
	});

	describe("when the signed-in account is not saved", () => {
		beforeEach(() => {
			live.value = "unsaved-tokens";
		});

		it("warns before overwriting it", async () => {
			await addAccount(createTempStore());
			expect(window.showWarningMessage).toHaveBeenCalledWith(
				"The account currently signed in is not saved. Logging in will overwrite it.",
				{ modal: true },
				"Save it first",
				"Overwrite"
			);
			expect(window.createTerminal).not.toHaveBeenCalled();
		});

		it("saves it first, then logs in", async () => {
			const store = createTempStore();
			window.showWarningMessage.mockResolvedValue("Save it first");
			window.showInputBox.mockResolvedValueOnce("Old account").mockResolvedValueOnce("New account");
			loginAs("new-tokens", FINISHED);
			await addAccount(store);
			const [old, added] = await store.list();
			await expect(store.credentialsFor(old!.id)).resolves.toBe("unsaved-tokens");
			await expect(store.credentialsFor(added!.id)).resolves.toBe("new-tokens");
			expect(added!.label).toBe("New account");
		});

		it("stops when saving it first is cancelled", async () => {
			window.showWarningMessage.mockResolvedValue("Save it first");
			await addAccount(createTempStore());
			expect(window.createTerminal).not.toHaveBeenCalled();
		});

		it("logs in without saving when told to overwrite", async () => {
			window.showWarningMessage.mockResolvedValue("Overwrite");
			await addAccount(createTempStore());
			expect(window.createTerminal).toHaveBeenCalled();
			expect(window.showInputBox).not.toHaveBeenCalled();
		});
	});

	describe("when a switch applies to this workspace only", () => {
		/** The id of the folder the login was pointed at. */
		const stagedId = () => vi.mocked(useWorkspaceAccount).mock.calls[0]![1]!;

		beforeEach(() => {
			useSettings({ switchScope: "workspace" });
			vi.mocked(useWorkspaceAccount).mockImplementation(async (store, id) => redirectConfigDir(id && loginDirFor(store.dir, id)));
		});

		it("logs in to a folder of its own and saves the account under that folder's id", async () => {
			usePlatform("darwin");
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			loginAs("personal-tokens", FINISHED);
			window.showInputBox.mockResolvedValue("Personal");
			await addAccount(store);
			expect(window.createTerminal).toHaveBeenCalledWith({
				name: "Claude login",
				shellPath: "/opt/homebrew/bin/claude",
				shellArgs: ["auth", "login"],
				env: { CLAUDE_CONFIG_DIR: loginDirFor(store.dir, stagedId()) }
			});
			await expect(store.active()).resolves.toMatchObject({ id: stagedId(), label: "Personal" });
			expect(useWorkspaceAccount).toHaveBeenCalledTimes(1);
			expect(removeLoginDir).not.toHaveBeenCalled();
			redirectConfigDir(undefined);
			await expect(store.activeId()).resolves.toBe(work.id);
		});

		it("does not warn about the shared login, which the new one cannot overwrite", async () => {
			live.value = "unsaved-tokens";
			await addAccount(createTempStore());
			expect(window.showWarningMessage).not.toHaveBeenCalled();
			expect(window.createTerminal).toHaveBeenCalled();
		});

		it("returns to the shared login and deletes the folder when the login is abandoned", async () => {
			const store = createTempStore();
			loginAs("personal-tokens", undefined);
			await addAccount(store);
			await expect(store.list()).resolves.toEqual([]);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, undefined);
			expect(removeLoginDir).toHaveBeenCalledWith(store.dir, stagedId());
		});

		it("returns to the workspace's previous account when the login is abandoned", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			redirectConfigDir(loginDirFor(store.dir, work.id));
			await addAccount(store);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, work.id);
		});

		it("moves to the saved account when the login turns out to be one already saved", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			loginAs("work-tokens", FINISHED);
			await addAccount(store);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, work.id);
			expect(removeLoginDir).toHaveBeenCalledWith(store.dir, stagedId());
		});
	});
});
