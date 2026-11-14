import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ensureLoginDir } from "../../src/workspace/ensureLoginDir";
import { healLoginDirs } from "../../src/workspace/healLoginDirs";
import { loginDirFor } from "../../src/workspace/loginDirFor";
import { createTempStore } from "../helpers/createTempStore";

vi.mock("../../src/workspace/ensureLoginDir");

describe("healLoginDirs", () => {
	it("relinks every login folder, saved or not, and removes none", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		for (const id of [work.id, "removed-id"]) {
			fs.mkdirSync(loginDirFor(store.dir, id), { recursive: true });
		}

		fs.writeFileSync(path.join(store.dir, "logins", ".DS_Store"), "");
		await healLoginDirs(store);
		expect(
			vi
				.mocked(ensureLoginDir)
				.mock.calls.map(([, id]) => id)
				.sort()
		).toEqual([work.id, "removed-id"].sort());
		expect(fs.readdirSync(path.join(store.dir, "logins")).sort()).toEqual([".DS_Store", work.id, "removed-id"].sort());
	});

	it("does nothing before any workspace has its own login", async () => {
		await healLoginDirs(createTempStore());
		expect(ensureLoginDir).not.toHaveBeenCalled();
	});
});
