import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { deleteSecret } from "../../src/keychain/deleteSecret";
import { serviceForConfigDir } from "../../src/keychain/serviceForConfigDir";
import type { ProfileStore } from "../../src/profiles/ProfileStore";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { removeAbandonedLoginDirs } from "../../src/workspace/removeAbandonedLoginDirs";
import { createTempStore } from "../helpers/createTempStore";
import { usePlatform } from "../helpers/usePlatform";

vi.mock("../../src/keychain/deleteSecret");

const TWO_HOURS_AGO = (Date.now() - 2 * 60 * 60_000) / 1000;

/** Makes a login folder for `id`, last changed two hours ago unless `recent`. */
function loginDir(store: ProfileStore, id: string, recent = false): string {
	const dir = loginDirFor(store.dir, id);
	fs.mkdirSync(dir, { recursive: true });
	if (!recent) {
		fs.utimesSync(dir, TWO_HOURS_AGO, TWO_HOURS_AGO);
	}

	return dir;
}

describe("removeAbandonedLoginDirs", () => {
	it("deletes an old folder no saved account owns, with its Keychain item", async () => {
		usePlatform("darwin");
		const store = createTempStore();
		const abandoned = loginDir(store, "abandoned-id");
		await removeAbandonedLoginDirs(store);
		expect(fs.existsSync(abandoned)).toBe(false);
		expect(deleteSecret).toHaveBeenCalledWith(serviceForConfigDir(abandoned));
	});

	it("keeps saved accounts' folders, this window's folder, a login still in progress, and stray files", async () => {
		usePlatform("linux");
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		const kept = [loginDir(store, work.id), loginDir(store, "in-progress-id", true), loginDir(store, "this-window-id")];
		vi.stubEnv("CLAUDE_CONFIG_DIR", kept[2]);
		const stray = path.join(store.dir, "logins", ".DS_Store");
		fs.writeFileSync(stray, "");
		await removeAbandonedLoginDirs(store);
		expect([...kept, stray].filter((entry) => fs.existsSync(entry))).toEqual([...kept, stray]);
	});

	it("does nothing before any workspace has its own login", async () => {
		await expect(removeAbandonedLoginDirs(createTempStore())).resolves.toBeUndefined();
	});
});
