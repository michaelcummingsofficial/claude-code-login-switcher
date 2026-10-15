import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";

export function resolveClaudePath(configured: string): string | null {
	if (configured.trim().length > 0) {
		return configured.trim();
	}

	const names = process.platform === "win32" ? ["claude.exe", "claude.cmd"] : ["claude"];
	const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
	for (const dir of [...pathDirs, ...fallbackDirs(), ...bundledDirs()]) {
		for (const name of names) {
			const candidate = path.join(dir, name);
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}

	return null;
}

/**
 * The extension host sees a login-shell PATH only when VS Code resolved one, so a GUI launch can miss
 * Homebrew, npm's global folder, and the native installer. Probe those too.
 */
function fallbackDirs(): string[] {
	const home = os.homedir();
	switch (process.platform) {
		case "win32":
			return [path.join(home, ".local", "bin"), ...(process.env.APPDATA ? [path.join(process.env.APPDATA, "npm")] : [])];
		case "darwin":
			return ["/opt/homebrew/bin", "/usr/local/bin", path.join(home, ".local/bin"), path.join(home, ".claude/local")];
		default:
			return [path.join(home, ".local/bin"), path.join(home, ".claude/local"), "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin"];
	}
}

// The Claude Code extension ships its own CLI, and for someone who only ever installed the extension it is the only one.
function bundledDirs(): string[] {
	const extension = vscode.extensions.getExtension("anthropic.claude-code");
	return extension ? [path.join(extension.extensionPath, "resources", "native-binary")] : [];
}
