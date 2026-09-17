import { describe, expect, it, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { saveCurrentAccount } from "../../src/commands/saveCurrentAccount";
import { createTempStore } from "../helpers/createTempStore";
import { useLiveCredential } from "../helpers/useLiveCredential";
import { useSettings } from "../helpers/useSettings";
import { window } from "../mocks/vscode";

vi.mock("../../src/claude/readAuthStatus");
vi.mock("../../src/credentials/resolveLiveCredential");

const tokens = '{"claudeAiOauth":{"accessToken":"a","refreshTokenExpiresAt":1789000000000}}';

describe("saveCurrentAccount", () => {
	it("says where it looked when there is no live login", async () => {
		const live = useLiveCredential(null);
		await expect(saveCurrentAccount(createTempStore())).resolves.toBeNull();
		expect(window.showErrorMessage).toHaveBeenCalledWith(`No Claude Code login found in ${live.location}. Run \`claude auth login\` first.`);
	});

	it("recognizes an account that is already saved and marks it active", async () => {
		const store = createTempStore();
		const work = await store.add({ label: "Work" }, tokens);
		await store.setActive(null);
		useLiveCredential(tokens);
		await expect(saveCurrentAccount(store)).resolves.toEqual(work);
		await expect(store.activeId()).resolves.toBe(work.id);
		expect(window.showInformationMessage).toHaveBeenCalledWith('This account is already saved as "Work".');
		expect(window.showInputBox).not.toHaveBeenCalled();
	});

	it("saves a new account with the details from `claude auth status`", async () => {
		useSettings({ claudePath: "/bin/claude" });
		const store = createTempStore();
		useLiveCredential(tokens);
		vi.mocked(readAuthStatus).mockResolvedValue({ loggedIn: true, email: "ada@work.com", orgName: "Acme", subscriptionType: "team" });
		window.showInputBox.mockResolvedValue("Work");
		const saved = await saveCurrentAccount(store);
		expect(readAuthStatus).toHaveBeenCalledWith("/bin/claude");
		expect(window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ title: "Save current Claude account", value: "ada@work.com" }));
		expect(saved).toMatchObject({
			label: "Work",
			email: "ada@work.com",
			orgName: "Acme",
			subscriptionType: "team",
			refreshTokenExpiresAt: 1789000000000
		});
		await expect(store.active()).resolves.toEqual(saved);
		await expect(store.credentialsFor(saved!.id)).resolves.toBe(tokens);
		expect(window.showInformationMessage).toHaveBeenCalledWith('Saved Claude account "Work".');
	});

	it.each([
		[{ loggedIn: true, subscriptionType: "max" }, "max account"],
		[null, "Claude account"]
	])("suggests a name from %j when there is no email", async (status, suggestion) => {
		useLiveCredential(tokens);
		vi.mocked(readAuthStatus).mockResolvedValue(status);
		await saveCurrentAccount(createTempStore());
		expect(window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ value: suggestion }));
	});

	it("saves nothing when the name prompt is dismissed", async () => {
		const store = createTempStore();
		useLiveCredential(tokens);
		await expect(saveCurrentAccount(store)).resolves.toBeNull();
		await expect(store.list()).resolves.toEqual([]);
	});
});
