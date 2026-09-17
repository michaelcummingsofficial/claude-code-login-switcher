import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeychainError } from "../../src/keychain/KeychainError";
import { readSecret } from "../../src/keychain/readSecret";
import { runSecurity } from "../../src/keychain/runSecurity";

vi.mock("../../src/keychain/runSecurity");

describe("readSecret", () => {
	beforeEach(() => {
		vi.stubEnv("USER", "alice");
	});

	it("reads the password for the account and service, trimmed", async () => {
		vi.mocked(runSecurity).mockResolvedValue('{"claudeAiOauth":{}}\n');
		await expect(readSecret("Claude Code-credentials")).resolves.toBe('{"claudeAiOauth":{}}');
		expect(runSecurity).toHaveBeenCalledWith(["find-generic-password", "-a", "alice", "-s", "Claude Code-credentials", "-w"]);
	});

	it("returns null for an empty password", async () => {
		vi.mocked(runSecurity).mockResolvedValue(" \n");
		await expect(readSecret("svc")).resolves.toBeNull();
	});

	it.each([
		[44, "the item does not exist"],
		[36, "the keychain is locked or missing"]
	])("returns null on exit %i, when %s", async (code) => {
		vi.mocked(runSecurity).mockRejectedValue(Object.assign(new Error("Command failed"), { code, stderr: "" }));
		await expect(readSecret("svc")).resolves.toBeNull();
	});

	it("throws a KeychainError for any other failure", async () => {
		vi.mocked(runSecurity).mockRejectedValue(Object.assign(new Error("Command failed"), { code: 51, stderr: "User interaction is not allowed." }));
		const error = await readSecret("svc").catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(KeychainError);
		expect(error).toMatchObject({ exitCode: 51, message: 'Could not read Keychain item "svc": User interaction is not allowed.' });
	});
});
