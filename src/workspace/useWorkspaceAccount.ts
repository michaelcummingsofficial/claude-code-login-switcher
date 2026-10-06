import { resolveLiveCredential } from "../credentials/resolveLiveCredential";
import { isSuperseded } from "../profiles/isSuperseded";
import type { ProfileStore } from "../profiles/ProfileStore";
import { getSettings } from "../settings/getSettings";
import { ensureLoginDir } from "./ensureLoginDir";
import { loginDirFor } from "./loginDirFor";
import { redirectConfigDir } from "./redirectConfigDir";

/** Points this window at the login of the saved account `id`. `undefined` goes back to the login every window shares. */
export async function useWorkspaceAccount(store: ProfileStore, id: string | undefined): Promise<void> {
	if (!id) {
		redirectConfigDir(undefined);
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
