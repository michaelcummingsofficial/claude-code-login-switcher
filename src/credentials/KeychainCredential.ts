import { readSecret } from "../keychain/readSecret";
import { writeSecret } from "../keychain/writeSecret";
import type { LiveCredential } from "./resolveLiveCredential";

export class KeychainCredential implements LiveCredential {
	readonly location: string;

	constructor(readonly service: string) {
		this.location = `Keychain item "${service}"`;
	}

	read(): Promise<string | null> {
		return readSecret(this.service);
	}

	write(credentials: string): Promise<void> {
		return writeSecret(this.service, credentials);
	}
}
