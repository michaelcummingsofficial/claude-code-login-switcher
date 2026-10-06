import fs from "node:fs/promises";
import { deleteSecret } from "../keychain/deleteSecret";
import { serviceForConfigDir } from "../keychain/serviceForConfigDir";
import { loginDirFor } from "./loginDirFor";

/** Deletes an account's workspace login: its folder of links and, on macOS, the Keychain item Claude Code made for it. */
export async function removeLoginDir(storeDir: string, id: string): Promise<void> {
	const dir = loginDirFor(storeDir, id);
	if (process.platform === "darwin") {
		await deleteSecret(serviceForConfigDir(dir));
	}

	await fs.rm(dir, { recursive: true, force: true });
}
