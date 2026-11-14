import fs from "node:fs";
import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { isSuperseded } from "../profiles/isSuperseded";
import type { ProfileStore } from "../profiles/ProfileStore";
import { loginDirFor } from "./loginDirFor";

/**
 * The newest copy of the account `id` the extension can reach: its saved copy, its folder's login, or `also`, a
 * login already known to be that account's. `null` when there is none.
 */
export async function newestLoginOf(store: ProfileStore, id: string, also: string | null = null): Promise<string | null> {
	const dir = loginDirFor(store.dir, id);
	const folder = fs.existsSync(dir) ? await (await resolveLiveCredential(dir)).read() : null;
	return [await store.credentialsFor(id), folder].reduce((best, copy) => (copy && (!best || isSuperseded(best, copy)) ? copy : best), also);
}
