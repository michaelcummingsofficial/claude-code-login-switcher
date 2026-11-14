import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { isSuperseded } from "../profiles/isSuperseded";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";
import { ensureLoginDir } from "./ensureLoginDir";
import { loginDirFor } from "./loginDirFor";
import { newestLoginOf } from "./newestLoginOf";
import { redirectConfigDir } from "./redirectConfigDir";

/**
 * Points this window at the login of the saved account `id`. `undefined` goes back to the login every window shares,
 * and so does the account that login belongs to: each account's login lives in one place, never two.
 */
export async function useWorkspaceAccount(store: ProfileStore, id: string | undefined): Promise<void> {
	if (!id || id === (await store.sharedId())) {
		redirectConfigDir(undefined);
		if (id) {
			await catchUpSharedLogin(store, id);
		}

		return;
	}

	const previous = getSettings().workspaceAccountId;
	redirectConfigDir(await ensureLoginDir(store.dir, id));
	try {
		const saved = await store.credentialsFor(id);
		const live = await resolveLiveCredential();
		const current = await live.read();
		// Other windows on this account refresh the login in place, so only a missing or older one is replaced.
		if (saved && (!current || isSuperseded(current, saved))) {
			await live.write(saved);
		}
	} catch (error) {
		redirectConfigDir(previous && loginDirFor(store.dir, previous));
		throw error;
	}
}

/** A login renewed into the saved copy, or a folder an older version gave the account, may be newer than the shared login. */
async function catchUpSharedLogin(store: ProfileStore, id: string): Promise<void> {
	const shared = await resolveLiveCredential();
	const current = await shared.read();
	const newest = await newestLoginOf(store, id, current);
	if (newest && newest !== current) {
		await shared.write(newest);
	}
}
