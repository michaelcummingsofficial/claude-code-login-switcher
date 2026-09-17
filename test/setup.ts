import { afterEach, beforeEach, vi } from "vitest";

const platform = Object.getOwnPropertyDescriptor(process, "platform")!;

beforeEach(() => {
	// A developer's own CLAUDE_CONFIG_DIR would change the Keychain item and file path every test expects.
	vi.stubEnv("CLAUDE_CONFIG_DIR", undefined);
});

afterEach(() => {
	Object.defineProperty(process, "platform", platform);
});
