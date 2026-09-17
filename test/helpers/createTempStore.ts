import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";
import { ProfileStore, type SecretVault } from "../../src/profiles/ProfileStore";
import { memoryVault } from "./memoryVault";

/** A store in a fresh temp directory that does not exist yet, removed when the test ends. */
export function createTempStore(vault: SecretVault = memoryVault()): ProfileStore {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-accounts-"));
	onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
	return new ProfileStore(path.join(root, "store"), vault);
}
