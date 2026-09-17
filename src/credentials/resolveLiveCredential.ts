import fs from "node:fs";
import { getSettings } from "../settings/getSettings";
import { CredentialsFile } from "./CredentialsFile";
import { KeychainCredential } from "./KeychainCredential";

/** The login Claude Code is using right now. */
export interface LiveCredential {
	/** Where it lives, for messages: a Keychain item or a file path. */
	readonly location: string;
	read(): Promise<string | null>;
	write(credentials: string): Promise<void>;
}

/**
 * Claude Code keeps its login in the Keychain on macOS and in `.credentials.json` everywhere else. A Mac also
 * falls back to that file when the Keychain rejects a write, such as over SSH, so the file wins there only
 * when no Keychain item exists.
 */
export async function resolveLiveCredential(): Promise<LiveCredential> {
	const settings = getSettings();
	const file = new CredentialsFile(settings.credentialsFile);
	if (process.platform !== "darwin") {
		return file;
	}

	const keychain = new KeychainCredential(settings.keychainService);
	if ((await keychain.read()) === null && fs.existsSync(file.location)) {
		return file;
	}

	return keychain;
}
