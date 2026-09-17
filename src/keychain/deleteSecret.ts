import { exitCodeOf } from "./exitCodeOf";
import { keychainAccount } from "./keychainAccount";
import { KeychainError } from "./KeychainError";
import { runSecurity } from "./runSecurity";
import { securityExitCode } from "./securityExitCode";

/** Resolves `false` when there was no item to delete. */
export async function deleteSecret(service: string): Promise<boolean> {
	try {
		await runSecurity(["delete-generic-password", "-a", keychainAccount(), "-s", service]);
		return true;
	} catch (error) {
		if (exitCodeOf(error) === securityExitCode.itemNotFound) {
			return false;
		}

		throw new KeychainError(`Could not delete Keychain item "${service}"`, error);
	}
}
