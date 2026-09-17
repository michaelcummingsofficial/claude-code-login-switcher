import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { CredentialsFile } from "../../src/credentials/CredentialsFile";
import { KeychainCredential } from "../../src/credentials/KeychainCredential";
import { resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";
import { readSecret } from "../../src/keychain/readSecret";
import { usePlatform } from "../helpers/usePlatform";
import { useSettings } from "../helpers/useSettings";

vi.mock("../../src/keychain/readSecret");

/** A Claude config folder, optionally holding a `.credentials.json`, that the settings point at. */
function useConfigDir(withFile: boolean): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-config-"));
	onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
	if (withFile) {
		fs.writeFileSync(path.join(dir, ".credentials.json"), "file-tokens");
	}

	useSettings({ claudeConfigDir: dir });
	return path.join(dir, ".credentials.json");
}

describe("resolveLiveCredential", () => {
	it.each(["linux", "win32"] as const)("uses .credentials.json on %s", async (platform) => {
		usePlatform(platform);
		const file = useConfigDir(false);
		const live = await resolveLiveCredential();
		expect(live).toBeInstanceOf(CredentialsFile);
		expect(live.location).toBe(file);
		expect(readSecret).not.toHaveBeenCalled();
	});

	it("uses the Keychain item on macOS", async () => {
		usePlatform("darwin");
		useConfigDir(true);
		vi.mocked(readSecret).mockResolvedValue("keychain-tokens");
		const live = await resolveLiveCredential();
		expect(live).toBeInstanceOf(KeychainCredential);
		await expect(live.read()).resolves.toBe("keychain-tokens");
	});

	it("uses the fallback file on macOS when the Keychain has no login but the file does", async () => {
		usePlatform("darwin");
		const file = useConfigDir(true);
		vi.mocked(readSecret).mockResolvedValue(null);
		const live = await resolveLiveCredential();
		expect(live.location).toBe(file);
		await expect(live.read()).resolves.toBe("file-tokens");
	});

	it("uses the Keychain item on macOS when neither holds a login, so a switch writes there", async () => {
		usePlatform("darwin");
		useConfigDir(false);
		vi.mocked(readSecret).mockResolvedValue(null);
		await expect(resolveLiveCredential()).resolves.toBeInstanceOf(KeychainCredential);
	});
});
