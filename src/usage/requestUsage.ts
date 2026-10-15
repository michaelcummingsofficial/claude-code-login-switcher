import { execFile } from "node:child_process";
import os from "node:os";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TIMEOUT_MS = 15_000;

export interface UsageResponse {
	status: number;
	body: string;
}

/**
 * Anthropic's edge has turned away Node's TLS handshake with 403 "Request not allowed" while accepting curl's,
 * so that answer, or a fetch that fails outright, is retried through curl.
 */
export async function requestUsage(accessToken: string): Promise<UsageResponse> {
	const headers = { "Authorization": `Bearer ${accessToken}`, "anthropic-beta": "oauth-2025-04-20" };
	const answer = await requestWithFetch(headers).catch(() => undefined);
	if (answer && !(answer.status === 403 && answer.body.includes("Request not allowed"))) {
		return answer;
	}

	return requestWithCurl(headers);
}

async function requestWithFetch(headers: Record<string, string>): Promise<UsageResponse> {
	const response = await fetch(USAGE_URL, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
	return { status: response.status, body: await response.text() };
}

function requestWithCurl(headers: Record<string, string>): Promise<UsageResponse> {
	return new Promise((resolve, reject) => {
		const child = execFile(
			process.platform === "win32" ? "curl.exe" : "curl",
			// `-H @-` reads the headers from stdin, which keeps the token out of the process list.
			["-sS", "--max-time", String(TIMEOUT_MS / 1000), "-H", "@-", "-w", "\n%{http_code}", USAGE_URL],
			// VS Code can leave the extension host in a folder that no longer exists, and spawning there fails.
			{ cwd: os.homedir(), timeout: TIMEOUT_MS + 5000, maxBuffer: 1024 * 1024 },
			(error, stdout) => {
				if (error) {
					reject(new Error("curl could not reach Anthropic."));
					return;
				}

				const split = stdout.lastIndexOf("\n");
				resolve({ status: Number(stdout.slice(split + 1)), body: stdout.slice(0, split) });
			}
		);
		child.stdin?.end(
			`${Object.entries(headers)
				.map(([name, value]) => `${name}: ${value}`)
				.join("\n")}\n`
		);
	});
}
