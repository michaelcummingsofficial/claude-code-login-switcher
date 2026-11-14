import type { ProfileStore } from "../profiles/ProfileStore";
import { pickedAtKey } from "./pickedAtKey";
import type { WorkspaceMemory } from "./WorkspaceMemory";

/**
 * The account signed in everywhere, when that happened after this workspace last picked its own. A workspace that
 * never picked, or picked before the time was recorded, counts as older. `undefined` once the account is removed.
 */
export function everywhereAccountFor(memory: WorkspaceMemory, store: ProfileStore): string | undefined {
	const { everywhere, profiles } = store.snapshot();
	const pickedAt = memory.workspaceState.get<number>(pickedAtKey) ?? 0;
	const saved = profiles.some((profile) => profile.id === everywhere?.id);
	return saved && everywhere && pickedAt < everywhere.at ? everywhere.id : undefined;
}
