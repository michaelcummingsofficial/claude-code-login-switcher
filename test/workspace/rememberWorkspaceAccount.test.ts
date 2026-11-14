import { describe, expect, it, vi } from "vitest";
import { pickedAtKey } from "../../src/workspace/pickedAtKey";
import { redirectConfigDir } from "../../src/workspace/redirectConfigDir";
import { rememberWorkspaceAccount } from "../../src/workspace/rememberWorkspaceAccount";
import { workspaceMemory } from "../helpers/workspaceMemory";

describe("rememberWorkspaceAccount", () => {
	it("hands the workspace account's folder to new terminals, and notes when it was picked", () => {
		vi.spyOn(Date, "now").mockReturnValue(5000);
		const memory = workspaceMemory();
		redirectConfigDir("/accounts/logins/work-id");
		rememberWorkspaceAccount(memory);
		expect(memory.environment.replace).toHaveBeenCalledWith("CLAUDE_CONFIG_DIR", "/accounts/logins/work-id");
		expect(memory.state.get(pickedAtKey)).toBe(5000);
	});

	it("does not touch a terminal environment that is already right, or the time it was picked", () => {
		const memory = workspaceMemory("/accounts/logins/work-id", 1000);
		redirectConfigDir("/accounts/logins/work-id");
		rememberWorkspaceAccount(memory);
		expect(memory.environment.replace).not.toHaveBeenCalled();
		expect(memory.environment.delete).not.toHaveBeenCalled();
		expect(memory.state.get(pickedAtKey)).toBe(1000);
	});

	it("clears the variable while the window follows the shared login, even one with its own CLAUDE_CONFIG_DIR, noting the pick", () => {
		vi.spyOn(Date, "now").mockReturnValue(5000);
		vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/cfg");
		const memory = workspaceMemory("/accounts/logins/work-id", 1000);
		rememberWorkspaceAccount(memory);
		expect(memory.environment.delete).toHaveBeenCalledWith("CLAUDE_CONFIG_DIR");
		expect(memory.environment.replace).not.toHaveBeenCalled();
		expect(memory.state.get(pickedAtKey)).toBe(5000);
	});

	it("leaves a workspace that already follows the shared login alone", () => {
		const memory = workspaceMemory();
		rememberWorkspaceAccount(memory);
		expect(memory.environment.delete).not.toHaveBeenCalled();
		expect(memory.state.has(pickedAtKey)).toBe(false);
	});
});
