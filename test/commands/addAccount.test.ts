import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { resolveClaudePath } from "../../src/claude/resolveClaudePath";
import { waitForLogin } from "../../src/claude/waitForLogin";
import { addAccount } from "../../src/commands/addAccount";
import { syncActiveAccount } from "../../src/profiles/syncActiveAccount";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { useWorkspaceAccount } from "../../src/workspace/useWorkspaceAccount";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { usePlatform } from "../helpers/usePlatform";
import { useSettings } from "../helpers/useSettings";
import { window } from "../mocks/vscode";

vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/claude/resolveClaudePath");
vi.mock("../../src/claude/waitForLogin");
vi.mock("../../src/credentials/resolveLiveCredential");
vi.mock("../../src/workspace/useWorkspaceAccount");

let live: FakeLiveCredential;
let terminal: { show: ReturnType<typeof vi.fn> };

/** Simulates `claude auth login` replacing the live login while the extension waits. `finished` is how the wait ends. */
function loginAs(tokens: string, finished = true): void {
	vi.mocked(waitForLogin).mockImplementation(async () => {
		live.value = tokens;
		return finished;
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
		loginAs("personal-tokens");
		window.showInputBox.mockResolvedValue("Personal");
		await addAccount(store);
		expect(window.showWarningMessage).not.toHaveBeenCalled();
		expect(window.createTerminal).toHaveBeenCalledWith({ name: "Claude login", shellPath: "/opt/homebrew/bin/claude", shellArgs: ["auth", "login"] });
		expect(terminal.show).toHaveBeenCalled();
		expect(waitForLogin).toHaveBeenCalledWith(terminal, "work-tokens", "Finish logging in to Claude in your browser.");
		const personal = await store.active();
		expect(personal).toMatchObject({ label: "Personal" });
		await expect(store.credentialsFor(personal!.id)).resolves.toBe("personal-tokens");
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
	});

	it("logs in again to a saved account whose login ended, keeping its name and place", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work", email: "ada@work.com" }, "work-tokens");
		live.value = '{"claudeAiOauth":{"accessToken":"","refreshToken":""}}';
		loginAs("work-renewed");
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true, email: "ada@work.com" });
		await addAccount(store, work);
		expect(window.showWarningMessage).not.toHaveBeenCalled();
		expect(waitForLogin).toHaveBeenCalledWith(terminal, expect.any(String), 'Finish logging in to "Work" in your browser. Sign in as ada@work.com.');
		expect(window.showInputBox).not.toHaveBeenCalled();
		await expect(store.list()).resolves.toHaveLength(1);
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-renewed");
		await expect(store.activeId()).resolves.toBe(work.id);
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
		vi.mocked(waitForLogin).mockImplementation(async () => {
			live.value = "personal-tokens";
			await syncActiveAccount(store);
			return false;
		});
		await addAccount(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-tokens");
		await expect(store.activeId()).resolves.toBeNull();
	});

	it("does not save when the login is cancelled", async () => {
		const store = createTempStore();
		loginAs("personal-tokens", false);
		await addAccount(store);
		await expect(store.list()).resolves.toEqual([]);
		expect(window.showInputBox).not.toHaveBeenCalled();
	});

	it("offers a way forward and leaves the active account alone when the CLI is missing", async () => {
		vi.mocked(resolveClaudePath).mockReturnValue(null);
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await addAccount(store);
		expect(window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("Claude Code was not found"), "Install Claude Code", "Set the path");
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
			loginAs("new-tokens");
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
		beforeEach(() => {
			useSettings({ switchScope: "workspace" });
			vi.mocked(useWorkspaceAccount).mockImplementation(async (store, id) => redirectConfigDir(id && loginDirFor(store.dir, id)));
		});

		it("logs in to the folder kept for a new account and saves the account under that folder's id", async () => {
			usePlatform("darwin");
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			const pending = await store.pendingLoginId();
			loginAs("personal-tokens");
			window.showInputBox.mockResolvedValue("Personal");
			await addAccount(store);
			expect(useWorkspaceAccount).toHaveBeenNthCalledWith(1, store, pending);
			expect(window.createTerminal).toHaveBeenCalledWith({
				name: "Claude login",
				shellPath: "/opt/homebrew/bin/claude",
				shellArgs: ["auth", "login"],
				env: { CLAUDE_CONFIG_DIR: loginDirFor(store.dir, pending) }
			});
			await expect(store.active()).resolves.toMatchObject({ id: pending, label: "Personal" });
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, pending);
			redirectConfigDir(undefined);
			await expect(store.activeId()).resolves.toBe(work.id);
			await expect(store.pendingLoginId()).resolves.not.toBe(pending);
		});

		it("does not warn about the shared login, which the new one cannot overwrite", async () => {
			live.value = "unsaved-tokens";
			await addAccount(createTempStore());
			expect(window.showWarningMessage).not.toHaveBeenCalled();
			expect(window.createTerminal).toHaveBeenCalled();
		});

		it("keeps the folder for the next try when the login is abandoned, and returns to the shared login", async () => {
			const store = createTempStore();
			const pending = await store.pendingLoginId();
			loginAs("personal-tokens", false);
			await addAccount(store);
			await expect(store.list()).resolves.toEqual([]);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, undefined);
			await expect(store.pendingLoginId()).resolves.toBe(pending);
		});

		it("returns to the workspace's previous account when the login is abandoned", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			redirectConfigDir(loginDirFor(store.dir, work.id));
			await addAccount(store);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, work.id);
		});

		it("logs in again where the saved account's login already lives, then uses it here", async () => {
			const store = createTempStore();
			await store.add({ label: "Personal" }, "personal-tokens");
			const work = await store.add({ label: "Work" }, "work-tokens");
			live.value = "work-ended";
			loginAs("work-renewed");
			await addAccount(store, work);
			expect(useWorkspaceAccount).toHaveBeenNthCalledWith(1, store, work.id);
			expect(waitForLogin).toHaveBeenCalledWith(terminal, "work-ended", 'Finish logging in to "Work" in your browser.');
			await expect(store.credentialsFor(work.id)).resolves.toBe("work-renewed");
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, work.id);
		});

		it("opens the login terminal on the shared login when that is where the account lives", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			vi.mocked(useWorkspaceAccount).mockImplementation(async () => redirectConfigDir(undefined));
			await addAccount(store, work);
			expect(window.createTerminal).toHaveBeenCalledWith(expect.objectContaining({ env: { CLAUDE_CONFIG_DIR: null } }));
			await expect(store.activeId()).resolves.toBe(work.id);
		});

		it("moves to the saved account when the login turns out to be one already saved", async () => {
			const store = createTempStore();
			const work = await store.add({ label: "Work" }, "work-tokens");
			loginAs("work-tokens");
			await addAccount(store);
			expect(useWorkspaceAccount).toHaveBeenLastCalledWith(store, work.id);
		});
	});
});
