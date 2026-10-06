import { afterEach, beforeEach, vi } from "vitest";
import { redirectMarker } from "../src/settings/redirectMarker";

const platform = Object.getOwnPropertyDescriptor(process, "platform")!;

beforeEach(() => {
	// A developer's own CLAUDE_CONFIG_DIR would change the Keychain item and file path every test expects.
	vi.stubEnv("CLAUDE_CONFIG_DIR", undefined);
	// Stubbing both lets a test redirect the window and get the real values back afterwards.
	vi.stubEnv(redirectMarker, undefined);
});

afterEach(() => {
	Object.defineProperty(process, "platform", platform);
});
