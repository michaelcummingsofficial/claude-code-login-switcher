import { execFile } from "node:child_process";

const TIMEOUT_MS = 5000;

/**
 * Resolves with stdout. The rejection carries `stderr` so callers can explain a
 * failure without the error's message, which repeats the full argv.
 */
export function runSecurity(args: string[], input?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = execFile("security", args, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				reject(Object.assign(error, { stderr }));
				return;
			}

			resolve(stdout);
		});
		child.stdin?.end(input);
	});
}
