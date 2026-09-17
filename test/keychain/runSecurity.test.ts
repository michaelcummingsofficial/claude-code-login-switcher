import { execFile } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSecurity } from "../../src/keychain/runSecurity";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

type Callback = (error: Error | null, stdout: string, stderr: string) => void;

const stdin = { end: vi.fn() };

function respond(error: Error | null, stdout: string, stderr: string): void {
	vi.mocked(execFile).mockImplementation(((_file: string, _args: string[], _options: object, callback: Callback) => {
		queueMicrotask(() => callback(error, stdout, stderr));
		return { stdin };
	}) as unknown as typeof execFile);
}

describe("runSecurity", () => {
	beforeEach(() => {
		stdin.end.mockReset();
	});

	it("runs security with a timeout and resolves stdout", async () => {
		respond(null, "secret\n", "");
		await expect(runSecurity(["find-generic-password", "-w"])).resolves.toBe("secret\n");
		expect(execFile).toHaveBeenCalledWith(
			"security",
			["find-generic-password", "-w"],
			expect.objectContaining({ timeout: 5000 }),
			expect.any(Function)
		);
	});

	it("writes the input to stdin and closes it", async () => {
		respond(null, "", "");
		await runSecurity(["-i"], "add-generic-password\n");
		expect(stdin.end).toHaveBeenCalledWith("add-generic-password\n");
	});

	it("closes stdin without input", async () => {
		respond(null, "", "");
		await runSecurity(["delete-generic-password"]);
		expect(stdin.end).toHaveBeenCalledWith(undefined);
	});

	it("rejects with stderr attached to the original error", async () => {
		const failure = Object.assign(new Error("Command failed"), { code: 44 });
		respond(failure, "", "The specified item could not be found in the keychain.\n");
		await expect(runSecurity(["find-generic-password"])).rejects.toMatchObject({
			code: 44,
			stderr: "The specified item could not be found in the keychain.\n"
		});
	});
});
