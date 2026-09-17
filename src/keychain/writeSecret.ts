import { keychainAccount } from "./keychainAccount";
import { KeychainError } from "./KeychainError";
import { readSecret } from "./readSecret";
import { runSecurity } from "./runSecurity";

/**
 * `security -i` reads one command line from stdin, which keeps the secret out of
 * argv. Claude Code itself switches to the `-X` hex form past this length, so we
 * mirror the same threshold.
 */
const STDIN_PAYLOAD_LIMIT = 4032;

/**
 * Writes, then reads back and compares. The `-i` tokenizer has to survive the
 * quotes and backslashes inside the credential JSON; if the round trip does not
 * match we redo it with the unambiguous hex form rather than leave a corrupt
 * item that would silently log the user out.
 */
export async function writeSecret(service: string, secret: string): Promise<void> {
	if (secret.length <= STDIN_PAYLOAD_LIMIT) {
		await write(service, ["-i"], `add-generic-password -U -a ${quote(keychainAccount())} -s ${quote(service)} -w ${quote(secret)}\n`);
		if ((await readSecret(service)) === secret) {
			return;
		}
	}

	const hex = Buffer.from(secret, "utf8").toString("hex");
	await write(service, ["add-generic-password", "-U", "-a", keychainAccount(), "-s", service, "-X", hex]);
	if ((await readSecret(service)) !== secret) {
		throw new KeychainError(`Keychain item "${service}" did not read back as written`);
	}
}

async function write(service: string, args: string[], input?: string): Promise<void> {
	try {
		await runSecurity(args, input);
	} catch (error) {
		throw new KeychainError(`Could not write Keychain item "${service}"`, error);
	}
}

function quote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
