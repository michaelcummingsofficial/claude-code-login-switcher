import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { CredentialsFile } from "../../src/credentials/CredentialsFile";

function claudeDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-dir-"));
	onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

describe("CredentialsFile", () => {
	it("uses the file path as its location", () => {
		expect(new CredentialsFile("/home/ada/.claude/.credentials.json").location).toBe("/home/ada/.claude/.credentials.json");
	});

	it("reads the login, trimmed", async () => {
		const file = path.join(claudeDir(), ".credentials.json");
		fs.writeFileSync(file, '{"claudeAiOauth":{}}\n');
		await expect(new CredentialsFile(file).read()).resolves.toBe('{"claudeAiOauth":{}}');
	});

	it.each([
		["a missing file", undefined],
		["an empty file", "  \n"]
	])("reads %s as signed out", async (_case, contents) => {
		const file = path.join(claudeDir(), ".credentials.json");
		if (contents !== undefined) {
			fs.writeFileSync(file, contents);
		}

		await expect(new CredentialsFile(file).read()).resolves.toBeNull();
	});

	it("throws for failures other than a missing file", async () => {
		await expect(new CredentialsFile(claudeDir()).read()).rejects.toMatchObject({ code: "EISDIR" });
	});

	it("writes the login, creating the Claude folder when needed", async () => {
		const file = path.join(claudeDir(), "new-config", ".credentials.json");
		const credentials = new CredentialsFile(file);
		await credentials.write('{"claudeAiOauth":{"accessToken":"a"}}');
		await expect(credentials.read()).resolves.toBe('{"claudeAiOauth":{"accessToken":"a"}}');
	});

	it.skipIf(process.platform === "win32")("writes the file readable by the owner only, like Claude Code", async () => {
		const file = path.join(claudeDir(), ".credentials.json");
		await new CredentialsFile(file).write("tokens");
		expect(fs.statSync(file).mode & 0o777).toBe(0o600);
	});
});
