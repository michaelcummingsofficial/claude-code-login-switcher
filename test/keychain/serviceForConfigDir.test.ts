import { describe, expect, it } from "vitest";
import { serviceForConfigDir } from "../../src/keychain/serviceForConfigDir";

describe("serviceForConfigDir", () => {
	it.each([undefined, ""])("uses the default service when the config dir is %j", (configDir) => {
		expect(serviceForConfigDir(configDir)).toBe("Claude Code-credentials");
	});

	it("appends the first 8 hex of sha256(configDir)", () => {
		expect(serviceForConfigDir("/tmp/cfg")).toBe("Claude Code-credentials-519e587f");
		expect(serviceForConfigDir("/Users/me/.claude-work")).toBe("Claude Code-credentials-1e91dd84");
	});

	it("hashes the NFC form, so decomposed and composed paths match", () => {
		expect(serviceForConfigDir("/Users/résumé")).toBe(serviceForConfigDir("/Users/résumé"));
	});
});
