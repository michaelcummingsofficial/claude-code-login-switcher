import { describe, expect, it, vi } from "vitest";
import type { EnvironmentVariableCollection } from "vscode";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { rememberWorkspaceAccount } from "../../src/workspace/rememberWorkspaceAccount";

function collection(value?: string) {
	const fake = { get: vi.fn(() => (value ? { value } : undefined)), replace: vi.fn(), delete: vi.fn() };
	return { fake, environment: fake as unknown as EnvironmentVariableCollection };
}

describe("rememberWorkspaceAccount", () => {
	it("hands the workspace account's folder to new terminals", () => {
		const { fake, environment } = collection();
		redirectConfigDir("/accounts/logins/work-id");
		rememberWorkspaceAccount(environment);
		expect(fake.replace).toHaveBeenCalledWith("CLAUDE_CONFIG_DIR", "/accounts/logins/work-id");
	});

	it("does not touch a terminal environment that is already right", () => {
		const { fake, environment } = collection("/accounts/logins/work-id");
		redirectConfigDir("/accounts/logins/work-id");
		rememberWorkspaceAccount(environment);
		expect(fake.replace).not.toHaveBeenCalled();
		expect(fake.delete).not.toHaveBeenCalled();
	});

	it("clears the variable while the window follows the shared login, even one with its own CLAUDE_CONFIG_DIR", () => {
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		const { fake, environment } = collection("/accounts/logins/work-id");
		rememberWorkspaceAccount(environment);
		expect(fake.delete).toHaveBeenCalledWith("CLAUDE_CONFIG_DIR");
		expect(fake.replace).not.toHaveBeenCalled();
	});
});
