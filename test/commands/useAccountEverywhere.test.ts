import { describe, expect, it, vi } from "vitest";
import { switchAccount } from "../../src/commands/switchAccount";
import { useAccountEverywhere } from "../../src/commands/useAccountEverywhere";
import { createTempStore } from "../helpers/createTempStore";

vi.mock("../../src/commands/switchAccount");

describe("useAccountEverywhere", () => {
	it("opens the switch picker for every workspace", async () => {
		const store = createTempStore();
		await useAccountEverywhere(store);
		expect(switchAccount).toHaveBeenCalledWith(store, true);
	});
});
