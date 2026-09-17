import { describe, expect, it, vi } from "vitest";
import { deleteSecret } from "../../src/keychain/deleteSecret";
import { KeychainVault } from "../../src/keychain/KeychainVault";
import { readSecret } from "../../src/keychain/readSecret";
import { writeSecret } from "../../src/keychain/writeSecret";

vi.mock("../../src/keychain/deleteSecret");
vi.mock("../../src/keychain/readSecret");
vi.mock("../../src/keychain/writeSecret");

describe("KeychainVault", () => {
	it("keeps each account's tokens in its own Keychain item", async () => {
		const vault = new KeychainVault();
		await vault.store("abc", "tokens");
		await vault.delete("abc");
		expect(writeSecret).toHaveBeenCalledWith("Claude Account Switcher-abc", "tokens");
		expect(deleteSecret).toHaveBeenCalledWith("Claude Account Switcher-abc");
	});

	it("reads an item, and a missing one as undefined like VS Code's secret storage", async () => {
		const vault = new KeychainVault();
		vi.mocked(readSecret).mockResolvedValueOnce("tokens").mockResolvedValueOnce(null);
		await expect(vault.get("abc")).resolves.toBe("tokens");
		await expect(vault.get("missing")).resolves.toBeUndefined();
		expect(readSecret).toHaveBeenCalledWith("Claude Account Switcher-abc");
	});
});
