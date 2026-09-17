import { exitCodeOf } from "./exitCodeOf";
import { keychainAccount } from "./keychainAccount";
import { KeychainError } from "./KeychainError";
import { runSecurity } from "./runSecurity";
import { securityExitCode } from "./securityExitCode";

export async function readSecret(service: string): Promise<string | null> {
	try {
		const stdout = await runSecurity(["find-generic-password", "-a", keychainAccount(), "-s", service, "-w"]);
		const value = stdout.trim();
		return value.length > 0 ? value : null;
	} catch (error) {
		const code = exitCodeOf(error);
		if (code === securityExitCode.itemNotFound || code === securityExitCode.keychainUnavailable) {
			return null;
		}

		throw new KeychainError(`Could not read Keychain item "${service}"`, error);
	}
}
