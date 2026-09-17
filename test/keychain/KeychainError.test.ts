import { describe, expect, it } from "vitest";
import { KeychainError } from "../../src/keychain/KeychainError";

const HEX_SECRET = Buffer.from('{"claudeAiOauth":{"accessToken":"sk-ant-oat01-secret"}}').toString("hex");

function commandFailure(fields: Record<string, unknown>): Error {
	return Object.assign(new Error(`Command failed: security add-generic-password -U -a alice -s svc -X ${HEX_SECRET}`), fields);
}

describe("KeychainError", () => {
	it("keeps a plain message when there is no underlying failure", () => {
		const error = new KeychainError("Keychain item did not read back as written");
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("KeychainError");
		expect(error.message).toBe("Keychain item did not read back as written");
		expect(error.exitCode).toBeNull();
	});

	it("appends stderr on one line and keeps the exit code", () => {
		const error = new KeychainError("Could not read", commandFailure({ code: 51, stderr: "security: first line\n  second line\n" }));
		expect(error.message).toBe("Could not read: security: first line; second line");
		expect(error.exitCode).toBe(51);
	});

	it("reports a timeout when the process was killed", () => {
		expect(new KeychainError("Could not write", commandFailure({ code: null, killed: true, stderr: "" })).message).toBe(
			"Could not write: security timed out"
		);
	});

	it.each([
		[1, "security failed (1)"],
		["ENOENT", "security failed (ENOENT)"]
	])("falls back to the code %j when stderr is empty", (code, reason) => {
		const error = new KeychainError("Could not write", commandFailure({ code, stderr: "" }));
		expect(error.message).toBe(`Could not write: ${reason}`);
	});

	it("never repeats the failed command line, which can hold the hex secret", () => {
		const error = new KeychainError("Could not write", commandFailure({ code: 1, stderr: "" }));
		expect(error.message).not.toContain(HEX_SECRET);
		expect(error.cause).toBeUndefined();
		expect(JSON.stringify(error)).not.toContain(HEX_SECRET);
	});

	it.each([null, {}])("describes %j as an unknown error", (failure) => {
		expect(new KeychainError("Could not read", failure).message).toBe("Could not read: unknown error");
	});
});
