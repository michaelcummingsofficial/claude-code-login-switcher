import { describe, expect, it, vi } from "vitest";
import { KeychainCredential } from "../../src/credentials/KeychainCredential";
import { readSecret } from "../../src/keychain/readSecret";
import { writeSecret } from "../../src/keychain/writeSecret";

vi.mock("../../src/keychain/readSecret");
vi.mock("../../src/keychain/writeSecret");

describe("KeychainCredential", () => {
	it("names the Keychain item as its location", () => {
		expect(new KeychainCredential("Claude Code-credentials").location).toBe('Keychain item "Claude Code-credentials"');
	});

	it("reads and writes the Keychain item", async () => {
		vi.mocked(readSecret).mockResolvedValue("tokens");
		const credential = new KeychainCredential("Claude Code-credentials-519e587f");
		await expect(credential.read()).resolves.toBe("tokens");
		await credential.write("rotated");
		expect(readSecret).toHaveBeenCalledWith("Claude Code-credentials-519e587f");
		expect(writeSecret).toHaveBeenCalledWith("Claude Code-credentials-519e587f", "rotated");
	});
});
