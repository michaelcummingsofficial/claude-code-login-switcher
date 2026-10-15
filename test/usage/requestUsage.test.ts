import { execFile } from "node:child_process";
import os from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestUsage } from "../../src/usage/requestUsage";
import { usePlatform } from "../helpers/usePlatform";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

type Callback = (error: Error | null, stdout: string) => void;

const fetchMock = vi.fn();
const stdin = { end: vi.fn() };

function answerFetch(status: number, body: string): void {
	fetchMock.mockResolvedValue({ status, text: async () => body });
}

function answerCurl(error: Error | null, stdout: string): void {
	vi.mocked(execFile).mockImplementation(((_file: string, _args: string[], _options: object, callback: Callback) => {
		queueMicrotask(() => callback(error, stdout));
		return { stdin };
	}) as unknown as typeof execFile);
}

describe("requestUsage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock);
		stdin.end.mockReset();
	});

	it("asks the usage endpoint with the token and the OAuth beta header", async () => {
		answerFetch(200, '{"limits":[]}');
		await expect(requestUsage("access-token")).resolves.toEqual({ status: 200, body: '{"limits":[]}' });
		expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/api/oauth/usage", {
			headers: { "Authorization": "Bearer access-token", "anthropic-beta": "oauth-2025-04-20" },
			signal: expect.any(AbortSignal)
		});
		expect(execFile).not.toHaveBeenCalled();
	});

	it("passes any other refusal straight back", async () => {
		answerFetch(429, '{"error":{"type":"rate_limit_error"}}');
		await expect(requestUsage("access-token")).resolves.toMatchObject({ status: 429 });
		expect(execFile).not.toHaveBeenCalled();
	});

	it.each([
		["refuses Node's handshake", () => answerFetch(403, '{"error":{"message":"Request not allowed"}}')],
		["fails outright", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))]
	])("retries through curl when fetch %s, with the token on stdin rather than in the process list", async (_case, fail) => {
		fail();
		answerCurl(null, '{"limits":[]}\n200');
		await expect(requestUsage("access-token")).resolves.toEqual({ status: 200, body: '{"limits":[]}' });
		const [file, args, options] = vi.mocked(execFile).mock.calls[0]! as unknown as [string, string[], { cwd: string }];
		expect(file).toBe("curl");
		expect(args).toEqual(["-sS", "--max-time", "15", "-H", "@-", "-w", "\n%{http_code}", "https://api.anthropic.com/api/oauth/usage"]);
		expect(args.join(" ")).not.toContain("access-token");
		expect(options.cwd).toBe(os.homedir());
		expect(stdin.end).toHaveBeenCalledWith("Authorization: Bearer access-token\nanthropic-beta: oauth-2025-04-20\n");
	});

	it("runs curl.exe on Windows", async () => {
		usePlatform("win32");
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		answerCurl(null, "{}\n200");
		await requestUsage("access-token");
		expect(vi.mocked(execFile).mock.calls[0]![0]).toBe("curl.exe");
	});

	it("rejects without repeating curl's command line when curl fails", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		answerCurl(new Error("Command failed: curl -H @- https://api.anthropic.com/api/oauth/usage"), "");
		await expect(requestUsage("access-token")).rejects.toThrow(/^curl could not reach Anthropic\.$/);
	});
});
