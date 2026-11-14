import type { ProfileStore } from "../profiles/ProfileStore";
import { switchAccount } from "./switchAccount";

export async function useAccountEverywhere(store: ProfileStore): Promise<void> {
	await switchAccount(store, true);
}
