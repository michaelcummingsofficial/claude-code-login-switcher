import { redirectMarker } from "../settings/redirectMarker";

/**
 * The Claude Code panel builds each session's environment from this process, so CLAUDE_CONFIG_DIR is the only
 * way to point it at another login. `undefined` puts back the value VS Code started with.
 */
export function redirectConfigDir(dir: string | undefined): void {
	const start = process.env[redirectMarker];
	if (dir) {
		process.env[redirectMarker] = start ?? process.env.CLAUDE_CONFIG_DIR ?? "";
		process.env.CLAUDE_CONFIG_DIR = dir;
		return;
	}

	delete process.env[redirectMarker];
	if (start) {
		process.env.CLAUDE_CONFIG_DIR = start;
	} else if (start !== undefined) {
		delete process.env.CLAUDE_CONFIG_DIR;
	}
}
