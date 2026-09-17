import { exitCodeOf } from "./exitCodeOf";

export class KeychainError extends Error {
	readonly exitCode: number | null;

	/**
	 * The failure is summarized into the message and never kept as `cause`: a failed
	 * command's own message repeats its argv, which holds the hex secret on the large-payload path.
	 */
	constructor(message: string, failure?: unknown) {
		super(failure === undefined ? message : `${message}: ${describeFailure(failure)}`);
		this.name = "KeychainError";
		this.exitCode = exitCodeOf(failure);
	}
}

/** Never reads stdout either: on a partial success it can hold secret material. */
function describeFailure(failure: unknown): string {
	const { stderr, code, killed } = (failure ?? {}) as { stderr?: unknown; code?: unknown; killed?: unknown };
	const text = typeof stderr === "string" ? stderr.trim() : "";
	if (text.length > 0) {
		return text.replace(/\s*\n\s*/g, "; ");
	}

	if (killed === true) {
		return "security timed out";
	}

	if (typeof code === "number" || typeof code === "string") {
		return `security failed (${code})`;
	}

	return "unknown error";
}
