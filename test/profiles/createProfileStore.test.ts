import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { readSecret } from "../../src/keychain/readSecret";
import { createProfileStore } from "../../src/profiles/createProfileStore";
import { usePlatform } from "../helpers/usePlatform";

vi.mock("../../src/keychain/readSecret");

function extensionContext() {
	const secrets = { get: vi.fn(async () => "editor-tokens"), store: vi.fn(), delete: vi.fn() };
	const context = { globalStorageUri: { fsPath: path.join(os.tmpdir(), "globalStorage", "claude-code-login-switcher") }, secrets };
	return { context: context as unknown as ExtensionContext, secrets };
}

describe("createProfileStore", () => {
	it("keeps accounts in ~/.claude-accounts with tokens in the Keychain on macOS", async () => {
		usePlatform("darwin");
		const { context, secrets } = extensionContext();
		vi.mocked(readSecret).mockResolvedValue("keychain-tokens");
		const store = createProfileStore(context);
		expect(store.path).toBe(path.join(os.homedir(), ".claude-accounts", "profiles.json"));
		await expect(store.credentialsFor("abc")).resolves.toBe("keychain-tokens");
		expect(readSecret).toHaveBeenCalledWith("Claude Account Switcher-abc");
		expect(secrets.get).not.toHaveBeenCalled();
	});

	it.each(["linux", "win32"] as const)("keeps accounts in the editor's storage with tokens in its secret storage on %s", async (platform) => {
		usePlatform(platform);
		const { context, secrets } = extensionContext();
		const store = createProfileStore(context);
		expect(store.dir).toBe(context.globalStorageUri.fsPath);
		await expect(store.credentialsFor("abc")).resolves.toBe("editor-tokens");
		expect(secrets.get).toHaveBeenCalledWith("abc");
		expect(readSecret).not.toHaveBeenCalled();
	});
});
