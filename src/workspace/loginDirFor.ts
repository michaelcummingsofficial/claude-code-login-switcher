import path from "node:path";

/** The config folder Claude Code is pointed at while a workspace uses the account `id`. */
export function loginDirFor(storeDir: string, id: string): string {
	return path.join(storeDir, "logins", id);
}
