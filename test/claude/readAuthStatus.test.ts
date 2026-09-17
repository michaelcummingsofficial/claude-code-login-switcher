import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { readAuthStatus } from "../../src/claude/readAuthStatus";
import { resolveClaudePath } from "../../src/claude/resolveClaudePath";

vi.mock("../../src/claude/resolveClaudePath");

/** A stand-in `claude` executable that runs the given shell script body. */
function fakeClaude(script: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
	onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
	const file = path.join(dir, "claude");
	fs.writeFileSync(file, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
	vi.mocked(resolveClaudePath).mockReturnValue(file);
	return file;
}

// The stand-in CLI is a shell script, which Windows cannot run. `claudeCommand` covers the Windows path.
describe.skipIf(process.platform === "win32")("readAuthStatus", () => {
	it("returns null without running anything when the CLI cannot be found", async () => {
		vi.mocked(resolveClaudePath).mockReturnValue(null);
		await expect(readAuthStatus("")).resolves.toBeNull();
	});

	it("resolves the CLI from the configured path", async () => {
		fakeClaude(`echo '{"loggedIn":false}'`);
		await readAuthStatus("/configured/claude");
		expect(resolveClaudePath).toHaveBeenCalledWith("/configured/claude");
	});

	it("parses the JSON from `claude auth status --json`", async () => {
		fakeClaude(`[ "$*" = "auth status --json" ] || exit 2
echo '{"loggedIn":true,"authMethod":"claude.ai","email":"ada@example.com","orgName":"Example","subscriptionType":"max"}'`);
		await expect(readAuthStatus("")).resolves.toEqual({
			loggedIn: true,
			authMethod: "claude.ai",
			email: "ada@example.com",
			orgName: "Example",
			subscriptionType: "max"
		});
	});

	it.each([
		["text output", "echo 'Logged in as ada@example.com'"],
		["JSON without loggedIn", `echo '{"email":"ada@example.com"}'`],
		["JSON null", "echo null"],
		["a non-zero exit", `echo '{"loggedIn":true}'; exit 1`]
	])("returns null for %s", async (_case, script) => {
		fakeClaude(script);
		await expect(readAuthStatus("")).resolves.toBeNull();
	});
});
