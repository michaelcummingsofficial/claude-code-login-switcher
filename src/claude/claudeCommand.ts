export interface ClaudeCommand {
	file: string;
	args: string[];
	/** Pass `args` to cmd.exe exactly as written. Node's own Windows quoting breaks cmd's rules. */
	verbatim: boolean;
}

/**
 * Windows can't start npm's `claude.cmd` shim without a shell, so it runs through cmd.exe. The `/s` flag makes
 * cmd strip only the outer pair of quotes, which keeps a quoted path with spaces intact.
 */
export function claudeCommand(claudePath: string, args: string[]): ClaudeCommand {
	if (process.platform === "win32" && /\.(cmd|bat)$/i.test(claudePath)) {
		return { file: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `""${claudePath}" ${args.join(" ")}"`], verbatim: true };
	}

	return { file: claudePath, args, verbatim: false };
}
