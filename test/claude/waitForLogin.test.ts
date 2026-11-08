import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import { waitForLogin } from "../../src/claude/waitForLogin";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { type FakeLiveCredential, useLiveCredential } from "../helpers/useLiveCredential";
import { ProgressLocation, window } from "../mocks/vscode";

vi.mock("../../src/credentials/resolveLiveCredential");

const signIn = (accessToken: string, refreshTokenExpiresAt?: number) =>
	JSON.stringify({ claudeAiOauth: { accessToken, refreshToken: "r", refreshTokenExpiresAt } });
const ended = '{"claudeAiOauth":{"accessToken":"","refreshToken":""}}';

let live: FakeLiveCredential;
let terminal: vscode.Terminal;
let cancel: () => void;
let closeTerminal: (closed: vscode.Terminal) => void;

/** Starts waiting, and reports whether it has settled and how. */
function wait(before: string | null): { result: () => boolean | undefined } {
	let result: boolean | undefined;
	void waitForLogin(terminal, before, "Finish logging in.").then((loggedIn) => {
		result = loggedIn;
	});
	return { result: () => result };
}

describe("waitForLogin", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		live = useLiveCredential(null);
		terminal = { dispose: vi.fn() } as unknown as vscode.Terminal;
		window.withProgress.mockImplementation(async (_options, task) =>
			task(
				{ report: vi.fn() },
				{
					isCancellationRequested: false,
					onCancellationRequested: (listener: () => void) => {
						cancel = listener;
						return { dispose: vi.fn() };
					}
				}
			)
		);
		window.onDidCloseTerminal.mockImplementation((listener: (closed: vscode.Terminal) => void) => {
			closeTerminal = listener;
			return { dispose: vi.fn() };
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows a cancellable notification while it waits", async () => {
		wait(null);
		await vi.advanceTimersByTimeAsync(0);
		expect(window.withProgress).toHaveBeenCalledWith(
			{ location: ProgressLocation.Notification, title: "Finish logging in.", cancellable: true },
			expect.any(Function)
		);
	});

	it("finishes on its own once a login lands in a folder that had none", async () => {
		const waiting = wait(null);
		await vi.advanceTimersByTimeAsync(1500);
		live.value = signIn("new");
		await vi.advanceTimersByTimeAsync(1500);
		expect(waiting.result()).toBeUndefined();
		await vi.advanceTimersByTimeAsync(3000);
		expect(waiting.result()).toBe(true);
		expect(terminal.dispose).not.toHaveBeenCalled();
	});

	it("finishes as soon as the CLI exits after writing the login", async () => {
		const waiting = wait(ended);
		live.value = signIn("new");
		await vi.advanceTimersByTimeAsync(1500);
		closeTerminal(terminal);
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(true);
	});

	it("waits through a refresh of the login that was already there", async () => {
		const waiting = wait(signIn("old", 5000));
		live.value = signIn("refreshed", 5000);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(waiting.result()).toBeUndefined();
		live.value = signIn("renewed", 9000);
		await vi.advanceTimersByTimeAsync(4500);
		expect(waiting.result()).toBe(true);
	});

	it("trusts a changed login without expiries only once the CLI has exited", async () => {
		const waiting = wait(signIn("old"));
		live.value = signIn("new");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(waiting.result()).toBeUndefined();
		closeTerminal(terminal);
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(true);
	});

	it("gives up when the terminal closes without a new login", async () => {
		const waiting = wait(signIn("old", 5000));
		live.value = signIn("refreshed", 5000);
		closeTerminal(terminal);
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(false);
	});

	it("ignores other terminals closing", async () => {
		const waiting = wait(null);
		closeTerminal({} as vscode.Terminal);
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBeUndefined();
	});

	it("closes the login terminal when cancelled, and stops checking", async () => {
		const waiting = wait(null);
		await vi.advanceTimersByTimeAsync(0);
		cancel();
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(false);
		expect(terminal.dispose).toHaveBeenCalled();
		const read = vi.spyOn(live, "read");
		await vi.advanceTimersByTimeAsync(10_000);
		expect(read).not.toHaveBeenCalled();
	});

	it("drops a check that was under way when the wait was cancelled", async () => {
		let release: (login: string | null) => void = () => undefined;
		vi.spyOn(live, "read").mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
		const waiting = wait(null);
		await vi.advanceTimersByTimeAsync(1500);
		cancel();
		release(signIn("new"));
		await vi.advanceTimersByTimeAsync(5000);
		expect(waiting.result()).toBe(false);
	});

	it("keeps the cancel when the terminal's last check lands after it", async () => {
		let release: (login: string | null) => void = () => undefined;
		const waiting = wait(null);
		await vi.advanceTimersByTimeAsync(0);
		vi.spyOn(live, "read").mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
		closeTerminal(terminal);
		cancel();
		release(signIn("new"));
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(false);
	});

	it("keeps checking after a failed read", async () => {
		vi.mocked(resolveLiveCredential).mockRejectedValueOnce(new Error("security failed (1)"));
		const waiting = wait(null);
		await vi.advanceTimersByTimeAsync(1500);
		live.value = signIn("new");
		await vi.advanceTimersByTimeAsync(4500);
		expect(waiting.result()).toBe(true);
	});

	it("does not count a login Claude Code cleared as a new one", async () => {
		const waiting = wait(null);
		live.value = ended;
		closeTerminal(terminal);
		await vi.advanceTimersByTimeAsync(0);
		expect(waiting.result()).toBe(false);
	});
});
