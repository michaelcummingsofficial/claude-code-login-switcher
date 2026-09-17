import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { writeFileAtomic } from "../../src/files/writeFileAtomic";

function tempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "write-atomic-"));
	onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

describe("writeFileAtomic", () => {
	it("creates missing folders and writes the contents", async () => {
		const file = path.join(tempDir(), "nested", "deeper", "file.json");
		await writeFileAtomic(file, '{"a":1}');
		expect(fs.readFileSync(file, "utf8")).toBe('{"a":1}');
	});

	it("replaces an existing file and leaves no temp file behind", async () => {
		const dir = tempDir();
		const file = path.join(dir, "file.json");
		fs.writeFileSync(file, "old");
		await writeFileAtomic(file, "new");
		expect(fs.readFileSync(file, "utf8")).toBe("new");
		expect(fs.readdirSync(dir)).toEqual(["file.json"]);
	});

	it.skipIf(process.platform === "win32")("keeps the folder and file readable by the owner only", async () => {
		const file = path.join(tempDir(), "private", "file.json");
		await writeFileAtomic(file, "secret");
		expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
		expect(fs.statSync(file).mode & 0o777).toBe(0o600);
	});
});
