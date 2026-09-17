import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { claudeCommand } from "./claudeCommand";
import { resolveClaudePath } from "./resolveClaudePath";

const run = promisify(execFile);

export interface AuthStatus {
	loggedIn: boolean;
	authMethod?: string;
	email?: string;
	orgName?: string;
	subscriptionType?: string;
}

/** Resolves `null` when the CLI cannot be found, fails, or prints something unexpected. */
export async function readAuthStatus(configuredPath: string): Promise<AuthStatus | null> {
	const claudePath = resolveClaudePath(configuredPath);
	if (!claudePath) {
		return null;
	}

	try {
		const command = claudeCommand(claudePath, ["auth", "status", "--json"]);
		const { stdout } = await run(command.file, command.args, { timeout: 15000, windowsVerbatimArguments: command.verbatim });
		const parsed = JSON.parse(stdout) as AuthStatus | null;
		return typeof parsed?.loggedIn === "boolean" ? parsed : null;
	} catch {
		return null;
	}
}
