import os from "node:os";
import path from "node:path";
import { getSettings } from "../settings/getSettings";

/** The config folder every login shares, whichever account this window uses. */
export function sharedConfigDir(): string {
	return path.resolve(getSettings().baseConfigDir || path.join(os.homedir(), ".claude"));
}
