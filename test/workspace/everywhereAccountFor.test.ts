import { describe, expect, it } from "vitest";
import { everywhereAccountFor } from "../../src/workspace/everywhereAccountFor";
import { createTempStore } from "../helpers/createTempStore";
import { workspaceMemory } from "../helpers/workspaceMemory";

describe("everywhereAccountFor", () => {
	it("names the account signed in everywhere for a workspace that picked before then, or never", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		await store.setEverywhere(work.id);
		const { at } = store.snapshot().everywhere!;
		expect(everywhereAccountFor(workspaceMemory("/accounts/logins/personal-id", at - 1), store)).toBe(work.id);
		expect(everywhereAccountFor(workspaceMemory(), store)).toBe(work.id);
	});

	it("is undefined for a pick made since, before anything was signed in everywhere, and once that account is removed", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		expect(everywhereAccountFor(workspaceMemory(), store)).toBeUndefined();
		await store.setEverywhere(work.id);
		expect(everywhereAccountFor(workspaceMemory("/accounts/logins/personal-id", store.snapshot().everywhere!.at), store)).toBeUndefined();
		await store.remove(work.id);
		expect(everywhereAccountFor(workspaceMemory(), store)).toBeUndefined();
	});
});
