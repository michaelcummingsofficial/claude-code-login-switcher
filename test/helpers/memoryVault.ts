import type { SecretVault } from "../../src/profiles/ProfileStore";

/** A vault backed by a Map that tests can inspect. */
export function memoryVault(): SecretVault & { items: Map<string, string> } {
	const items = new Map<string, string>();
	return {
		items,
		get: async (id) => items.get(id),
		store: async (id, credentials) => {
			items.set(id, credentials);
		},
		delete: async (id) => {
			items.delete(id);
		}
	};
}
