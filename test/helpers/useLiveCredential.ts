import { vi } from "vitest";
import { type LiveCredential, resolveLiveCredential } from "../../src/credentials/resolveLiveCredential";

export interface FakeLiveCredential extends LiveCredential {
	value: string | null;
}

/**
 * Backs Claude Code's live login with a plain value. Mocks are hoisted per file, so the calling test must
 * `vi.mock` `src/credentials/resolveLiveCredential` itself.
 */
export function useLiveCredential(value: string | null = null): FakeLiveCredential {
	const live: FakeLiveCredential = {
		location: 'Keychain item "Claude Code-credentials"',
		value,
		read: async () => live.value,
		write: async (credentials) => {
			live.value = credentials;
		}
	};
	vi.mocked(resolveLiveCredential).mockResolvedValue(live);
	return live;
}
