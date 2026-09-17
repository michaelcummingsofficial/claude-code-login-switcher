import os from "node:os";
import { describe, expect, it, vi } from "vitest";
import { keychainAccount } from "../../src/keychain/keychainAccount";

describe("keychainAccount", () => {
	it("uses $USER", () => {
		vi.stubEnv("USER", "alice.smith-2");
		expect(keychainAccount()).toBe("alice.smith-2");
	});

	it("falls back to the OS username when $USER is empty", () => {
		vi.stubEnv("USER", "");
		vi.spyOn(os, "userInfo").mockReturnValue({ username: "bob" } as os.UserInfo<string>);
		expect(keychainAccount()).toBe("bob");
	});

	it.each(["john doe", "o'neil", "jöhn"])("uses the generic account for the unsafe name %j, like Claude Code", (user) => {
		vi.stubEnv("USER", user);
		expect(keychainAccount()).toBe("claude-code-user");
	});

	it("uses the generic account when the username cannot be read", () => {
		vi.stubEnv("USER", "");
		vi.spyOn(os, "userInfo").mockImplementation(() => {
			throw new Error("uv_os_get_passwd returned ENOENT");
		});
		expect(keychainAccount()).toBe("claude-code-user");
	});
});
