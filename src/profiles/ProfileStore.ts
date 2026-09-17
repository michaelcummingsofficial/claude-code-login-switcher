import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "../files/writeFileAtomic";

export interface Profile {
	id: string;
	label: string;
	email?: string;
	orgName?: string;
	subscriptionType?: string;
	/** Epoch ms. Past this the account needs a fresh `claude auth login`. */
	refreshTokenExpiresAt?: number;
	savedAt: number;
}

/** Where saved tokens live, keyed by profile id. VS Code's `SecretStorage` fits as is. */
export interface SecretVault {
	get(id: string): PromiseLike<string | undefined>;
	store(id: string, credentials: string): PromiseLike<void>;
	delete(id: string): PromiseLike<void>;
}

interface StoreFile {
	version: 1;
	activeId: string | null;
	profiles: Profile[];
}

/**
 * Every VS Code window runs its own copy of the extension against the same file,
 * so nothing is cached. A stale `activeId` in one window would sync the account
 * another window just switched to over the wrong saved profile.
 */
export class ProfileStore {
	readonly path: string;

	constructor(
		readonly dir: string,
		private readonly vault: SecretVault
	) {
		this.path = path.join(dir, "profiles.json");
	}

	async list(): Promise<Profile[]> {
		return (await this.read()).profiles;
	}

	async activeId(): Promise<string | null> {
		return (await this.read()).activeId;
	}

	async active(): Promise<Profile | null> {
		const store = await this.read();
		return store.profiles.find((profile) => profile.id === store.activeId) ?? null;
	}

	async add(profile: Omit<Profile, "id" | "savedAt">, credentials: string): Promise<Profile> {
		const created: Profile = { ...profile, id: randomUUID(), savedAt: Date.now() };
		await this.vault.store(created.id, credentials);
		const store = await this.read();
		store.profiles.push(created);
		store.activeId = created.id;
		await this.write(store);
		return created;
	}

	async update(id: string, patch: Partial<Omit<Profile, "id">>, credentials?: string): Promise<void> {
		const store = await this.read();
		const profile = store.profiles.find((candidate) => candidate.id === id);
		if (!profile) {
			return;
		}

		if (credentials !== undefined) {
			await this.vault.store(id, credentials);
		}

		Object.assign(profile, patch, { savedAt: Date.now() });
		await this.write(store);
	}

	async credentialsFor(id: string): Promise<string | null> {
		return (await this.vault.get(id)) ?? null;
	}

	async setActive(id: string | null): Promise<void> {
		const store = await this.read();
		store.activeId = id;
		await this.write(store);
	}

	async remove(id: string): Promise<void> {
		await this.vault.delete(id);
		const store = await this.read();
		store.profiles = store.profiles.filter((profile) => profile.id !== id);
		if (store.activeId === id) {
			store.activeId = null;
		}

		await this.write(store);
	}

	private async read(): Promise<StoreFile> {
		try {
			const parsed = JSON.parse(await fs.readFile(this.path, "utf8")) as Partial<StoreFile> | null;
			return {
				version: 1,
				activeId: typeof parsed?.activeId === "string" ? parsed.activeId : null,
				profiles: Array.isArray(parsed?.profiles) ? parsed.profiles : []
			};
		} catch {
			return { version: 1, activeId: null, profiles: [] };
		}
	}

	private async write(store: StoreFile): Promise<void> {
		await writeFileAtomic(this.path, `${JSON.stringify(store, null, 2)}\n`);
	}
}
