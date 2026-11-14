import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeCodeRestarter } from "../../src/claude/ClaudeCodeRestarter";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import type { ProfileStore } from "../../src/profiles/ProfileStore";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { createTempStore } from "../helpers/createTempStore";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { commands, extensions } from "../mocks/vscode";

vi.mock("../../src/credentials/resolveLiveCredential");

const restartExtensionHost = "workbench.action.restartExtensionHost";
const ended = '{"claudeAiOauth":{"accessToken":"","refreshToken":"","expiresAt":0}}';

let live: FakeLiveCredential;

/** Follows `change`, then lets a restart it scheduled go out. */
async function follow(change: () => Promise<unknown>): Promise<void> {
	await restarter.follow(change);
	await new Promise((resolve) => setTimeout(resolve));
}

let store: ProfileStore;
let restarter: ClaudeCodeRestarter;

describe("ClaudeCodeRestarter", () => {
	beforeEach(() => {
		extensions.getExtension.mockImplementation((id: string) => (id === "anthropic.claude-code" ? { isActive: true } : undefined));
		store = createTempStore();
		restarter = new ClaudeCodeRestarter(store);
		live = useLiveCredential("work-tokens");
	});

	it.each([
		["no login", null],
		["a login Anthropic refused", ended]
	])("restarts Claude Code when a login lands while it had %s, so its sign-in screen goes away", async (_case, before) => {
		live.value = before;
		await follow(async () => {
			live.value = "work-renewed";
		});
		expect(commands.executeCommand).toHaveBeenCalledWith(restartExtensionHost);
	});

	it("leaves Claude Code alone while the window stays signed out", async () => {
		live.value = ended;
		await follow(async () => undefined);
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("counts a login it cannot read as signed out", async () => {
		vi.mocked(resolveLiveCredential).mockResolvedValueOnce({ location: "x", read: () => Promise.reject(new Error("locked")), write: vi.fn() });
		await follow(async () => undefined);
		expect(commands.executeCommand).toHaveBeenCalledWith(restartExtensionHost);
	});

	it("restarts Claude Code once a change points this window at another login folder", async () => {
		const change = vi.fn(async () => {
			expect(commands.executeCommand).not.toHaveBeenCalled();
			redirectConfigDir("/accounts/logins/work-id");
		});
		await follow(change);
		expect(change).toHaveBeenCalled();
		expect(commands.executeCommand).toHaveBeenCalledWith(restartExtensionHost);
	});

	it("restarts Claude Code when the shared login moves to another saved account", async () => {
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		await follow(() => store.setActive(work.id));
		expect(commands.executeCommand).toHaveBeenCalledWith(restartExtensionHost);
	});

	it("leaves Claude Code running when the change keeps the login", async () => {
		await store.add({ label: "Work" }, "work-tokens");
		await follow(async () => undefined);
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("leaves Claude Code running when the login in use is saved, since its tokens stay put", async () => {
		await follow(() => store.add({ label: "Work" }, "work-tokens"));
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("leaves Claude Code running when the account in use is removed, since its tokens stay put", async () => {
		const work = await store.add({ label: "Work" }, "work-tokens");
		await follow(() => store.remove(work.id));
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it.each([
		["is not installed", undefined],
		["has not started in this window", { isActive: false }]
	])("only runs the change when Claude Code %s", async (_case, extension) => {
		extensions.getExtension.mockReturnValue(extension);
		const change = vi.fn(async () => redirectConfigDir("/accounts/logins/work-id"));
		await follow(change);
		expect(change).toHaveBeenCalled();
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("only runs the change when claudeAccounts.restartClaudeCode is off", async () => {
		useSettings({ restartClaudeCode: false });
		const change = vi.fn(async () => redirectConfigDir("/accounts/logins/work-id"));
		await follow(change);
		expect(change).toHaveBeenCalled();
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("restarts once when a settings change and the command behind it both see the switch", async () => {
		// The extension host goes away mid-restart, so the command never answers.
		commands.executeCommand.mockReturnValue(new Promise(() => undefined));
		let started!: () => void;
		let finish!: () => void;
		const commandStarted = new Promise<void>((resolve) => (started = resolve));
		const command = restarter.follow(() => {
			started();
			return new Promise<void>((resolve) => (finish = resolve));
		});
		await commandStarted;
		void restarter.follow(async () => redirectConfigDir("/accounts/logins/work-id"));
		await vi.waitFor(() => expect(commands.executeCommand).toHaveBeenCalledTimes(1));
		finish();
		await command;
		await new Promise((resolve) => setTimeout(resolve));
		expect(commands.executeCommand).toHaveBeenCalledTimes(1);
	});

	it("answers the command before restarting, so VS Code never reports the click as cancelled", async () => {
		await restarter.follow(async () => redirectConfigDir("/accounts/logins/work-id"));
		expect(commands.executeCommand).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(commands.executeCommand).toHaveBeenCalledWith(restartExtensionHost));
	});

	it("restarts again after a restart was declined, or failed", async () => {
		commands.executeCommand.mockRejectedValueOnce(new Error("declined"));
		await follow(async () => redirectConfigDir("/accounts/logins/work-id"));
		await follow(async () => redirectConfigDir("/accounts/logins/personal-id"));
		expect(commands.executeCommand).toHaveBeenCalledTimes(2);
	});
});
