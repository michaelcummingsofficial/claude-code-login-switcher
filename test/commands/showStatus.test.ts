import { describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { showStatus } from "../../src/commands/showStatus";
import { createTempStore } from "../helpers/createTempStore";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { window } from "../mocks/vscode";

vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/credentials/resolveLiveCredential");

function reportedLines(): string[] {
	return String(window.showInformationMessage.mock.calls[0]![0]).split("\n");
}

describe("showStatus", () => {
	it("reports the live login, saved accounts, active account and CLI status in a modal", async () => {
		useLiveCredential(null);
		const store = createTempStore();
		await store.add({ label: "Work" }, "work-tokens");
		await store.add({ label: "Personal" }, "personal-tokens");
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true, email: "ada@home.com", subscriptionType: "pro" });
		await showStatus(store);
		expect(reportedLines()).toEqual([
			'Live login: Keychain item "Claude Code-credentials"',
			`Saved accounts: 2 (${store.path})`,
			"Active saved account: Personal",
			"claude auth status: ada@home.com (pro)"
		]);
		expect(window.showInformationMessage.mock.calls[0]![1]).toEqual({ modal: true });
	});

	it("syncs rotated tokens before reporting", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, "work-tokens");
		useLiveCredential("work-rotated");
		await showStatus(store);
		await expect(store.credentialsFor(work.id)).resolves.toBe("work-rotated");
	});

	it.each([
		[null, "could not run the CLI"],
		[{ loggedIn: false }, "signed out"],
		[{ loggedIn: true, authMethod: "console" }, "signed in (console)"],
		[{ loggedIn: true }, "signed in (unknown plan)"]
	])("describes the CLI status %j", async (status, description) => {
		useLiveCredential(null);
		vi.mocked(readAuthStatus).mockResolvedValue(status);
		await showStatus(createTempStore());
		expect(reportedLines()).toContain(`claude auth status: ${description}`);
		expect(reportedLines()).toContain("Active saved account: none");
	});
});
