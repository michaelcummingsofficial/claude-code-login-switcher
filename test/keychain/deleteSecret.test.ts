import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSecret } from "../../src/keychain/deleteSecret";
import { KeychainError } from "../../src/keychain/KeychainError";
import { runSecurity } from "../../src/keychain/runSecurity";

vi.mock("../../src/keychain/runSecurity");

describe("deleteSecret", () => {
	beforeEach(() => {
		vi.stubEnv("USER", "alice");
	});

	it("deletes the item and resolves true", async () => {
		vi.mocked(runSecurity).mockResolvedValue("");
		await expect(deleteSecret("svc")).resolves.toBe(true);
		expect(runSecurity).toHaveBeenCalledWith(["delete-generic-password", "-a", "alice", "-s", "svc"]);
	});

	it("resolves false when there is no such item", async () => {
		vi.mocked(runSecurity).mockRejectedValue(Object.assign(new Error("Command failed"), { code: 44, stderr: "" }));
		await expect(deleteSecret("svc")).resolves.toBe(false);
	});

	it("throws a KeychainError for any other failure", async () => {
		vi.mocked(runSecurity).mockRejectedValue(Object.assign(new Error("Command failed"), { code: 36, stderr: "Keychain is locked." }));
		const error = await deleteSecret("svc").catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(KeychainError);
		expect(error).toMatchObject({ exitCode: 36, message: 'Could not delete Keychain item "svc": Keychain is locked.' });
	});
});
