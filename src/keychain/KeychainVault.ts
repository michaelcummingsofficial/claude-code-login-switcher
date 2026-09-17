import type { SecretVault } from "../profiles/ProfileStore";
import { deleteSecret } from "./deleteSecret";
import { readSecret } from "./readSecret";
import { writeSecret } from "./writeSecret";

/** Saved tokens on macOS: one Keychain item per account, which every editor on the Mac can read. */
export class KeychainVault implements SecretVault {
	async get(id: string): Promise<string | undefined> {
		return (await readSecret(service(id))) ?? undefined;
	}

	async store(id: string, credentials: string): Promise<void> {
		await writeSecret(service(id), credentials);
	}

	async delete(id: string): Promise<void> {
		await deleteSecret(service(id));
	}
}

function service(id: string): string {
	return `Claude Account Switcher-${id}`;
}
