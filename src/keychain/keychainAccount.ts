import os from "node:os";

const FALLBACK_ACCOUNT = "claude-code-user";

/** Mirrors Claude Code's account derivation so we address the exact same item. */
export function keychainAccount(): string {
	let user: string;
	try {
		user = process.env.USER || os.userInfo().username;
	} catch {
		return FALLBACK_ACCOUNT;
	}

	return /^[a-zA-Z0-9._-]+$/.test(user) ? user : FALLBACK_ACCOUNT;
}
