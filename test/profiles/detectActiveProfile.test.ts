import { describe, expect, it } from "vitest";
import { detectActiveProfile } from "../../src/profiles/detectActiveProfile";
import { createTempStore } from "../helpers/createTempStore";

describe("detectActiveProfile", () => {
	it("finds the profile holding the live credentials and marks it active", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		await expect(detectActiveProfile(store, "work-tokens")).resolves.toEqual(work);
		await expect(store.activeId()).resolves.toBe(work.id);
	});

	it("returns null and leaves the active profile alone when nothing matches", async () => {
		const store = createTempStore();
		const personal = await store.add({ label: "Personal" }, "personal-tokens");
		await expect(detectActiveProfile(store, "someone-else")).resolves.toBeNull();
		await expect(store.activeId()).resolves.toBe(personal.id);
	});
});
