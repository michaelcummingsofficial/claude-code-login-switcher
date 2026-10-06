import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { deleteSecret } from "../../src/keychain/deleteSecret";
import { serviceForConfigDir } from "../../src/keychain/serviceForConfigDir";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { removeLoginDir } from "../../src/workspace/removeLoginDir";
import { usePlatform } from "../helpers/usePlatform";
import { useSettings } from "../helpers/useSettings";

vi.mock("../../src/keychain/deleteSecret");

let base: string;
let storeDir: string;

describe("removeLoginDir", () => {
	beforeEach(() => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-login-"));
		onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
		base = path.join(root, "config");
		storeDir = path.join(root, "store");
		fs.mkdirSync(path.join(base, "projects"), { recursive: true });
		fs.writeFileSync(path.join(base, "settings.json"), "{}");
		useSettings({ claudeConfigDir: base });
	});

	it("deletes the folder and its login, leaving the shared files it linked to", async () => {
		usePlatform("linux");
		const dir = await ensureLoginDir(storeDir, "work-id");
		fs.writeFileSync(path.join(dir, ".credentials.json"), "work-login");
		await removeLoginDir(storeDir, "work-id");
		expect(fs.existsSync(dir)).toBe(false);
		expect(fs.readdirSync(base).sort()).toEqual(["projects", "settings.json"]);
		expect(deleteSecret).not.toHaveBeenCalled();
	});

	it("deletes the Keychain item Claude Code made for the folder on macOS", async () => {
		usePlatform("darwin");
		await removeLoginDir(storeDir, "work-id");
		expect(deleteSecret).toHaveBeenCalledWith(serviceForConfigDir(path.join(storeDir, "logins", "work-id")));
	});
});
