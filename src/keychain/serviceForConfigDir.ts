import { createHash } from "node:crypto";

const DEFAULT_SERVICE = "Claude Code-credentials";

/**
 * Claude Code names the item `Claude Code-credentials`, suffixed with the first
 * 8 hex of sha256(configDir) when CLAUDE_CONFIG_DIR is set.
 */
export function serviceForConfigDir(configDir: string | undefined): string {
	if (!configDir) {
		return DEFAULT_SERVICE;
	}

	const hash = createHash("sha256").update(configDir.normalize("NFC")).digest("hex").slice(0, 8);
	return `${DEFAULT_SERVICE}-${hash}`;
}
