import fs from "node:fs/promises";
import { writeFileAtomic } from "../files/writeFileAtomic";
import type { LiveCredential } from "./resolveLiveCredential";

export class CredentialsFile implements LiveCredential {
	constructor(readonly location: string) {}

	async read(): Promise<string | null> {
		try {
			const value = (await fs.readFile(this.location, "utf8")).trim();
			return value.length > 0 ? value : null;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return null;
			}

			throw error;
		}
	}

	async write(credentials: string): Promise<void> {
		await writeFileAtomic(this.location, credentials);
	}
}
