import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeychainError } from "../../src/keychain/KeychainError";
import { readSecret } from "../../src/keychain/readSecret";
import { runSecurity } from "../../src/keychain/runSecurity";
import { writeSecret } from "../../src/keychain/writeSecret";

vi.mock("../../src/keychain/readSecret");
vi.mock("../../src/keychain/runSecurity");

const hex = (value: string) => Buffer.from(value, "utf8").toString("hex");

describe("writeSecret", () => {
	beforeEach(() => {
		vi.stubEnv("USER", "alice");
		vi.mocked(runSecurity).mockResolvedValue("");
	});

	it("writes a small secret through stdin so it never appears in argv", async () => {
		vi.mocked(readSecret).mockResolvedValue("token");
		await writeSecret("svc", "token");
		expect(runSecurity).toHaveBeenCalledTimes(1);
		expect(runSecurity).toHaveBeenCalledWith(["-i"], 'add-generic-password -U -a "alice" -s "svc" -w "token"\n');
		expect(readSecret).toHaveBeenCalledWith("svc");
	});

	it("escapes quotes and backslashes for the stdin tokenizer", async () => {
		const secret = String.raw`{"token":"a\"b\\c"}`;
		vi.mocked(readSecret).mockResolvedValue(secret);
		await writeSecret("svc", secret);
		expect(runSecurity).toHaveBeenCalledWith(["-i"], String.raw`add-generic-password -U -a "alice" -s "svc" -w "{\"token\":\"a\\\"b\\\\c\"}"` + "\n");
	});

	it("rewrites with the hex form when the stdin round trip does not match", async () => {
		vi.mocked(readSecret).mockResolvedValueOnce("corrupted").mockResolvedValueOnce("token");
		await writeSecret("svc", "token");
		expect(runSecurity).toHaveBeenCalledTimes(2);
		expect(runSecurity).toHaveBeenLastCalledWith(["add-generic-password", "-U", "-a", "alice", "-s", "svc", "-X", hex("token")], undefined);
	});

	it("uses the hex form directly past the stdin payload limit, like Claude Code", async () => {
		const secret = "x".repeat(4033);
		vi.mocked(readSecret).mockResolvedValue(secret);
		await writeSecret("svc", secret);
		expect(runSecurity).toHaveBeenCalledTimes(1);
		expect(runSecurity).toHaveBeenCalledWith(["add-generic-password", "-U", "-a", "alice", "-s", "svc", "-X", hex(secret)], undefined);
	});

	it("keeps the stdin form at exactly the payload limit", async () => {
		const secret = "x".repeat(4032);
		vi.mocked(readSecret).mockResolvedValue(secret);
		await writeSecret("svc", secret);
		expect(runSecurity).toHaveBeenCalledWith(["-i"], expect.any(String));
	});

	it("throws when the hex write does not read back either", async () => {
		vi.mocked(readSecret).mockResolvedValue("corrupted");
		await expect(writeSecret("svc", "token")).rejects.toThrow(new KeychainError('Keychain item "svc" did not read back as written'));
	});

	it("wraps a failed write without leaking the secret", async () => {
		const secret = "x".repeat(5000);
		vi
			.mocked(runSecurity)
			.mockRejectedValue(Object.assign(new Error(`Command failed: security add-generic-password -X ${hex(secret)}`), { code: 1, stderr: "" }));
		const error = await writeSecret("svc", secret).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(KeychainError);
		expect((error as KeychainError).message).toBe('Could not write Keychain item "svc": security failed (1)');
		expect(readSecret).not.toHaveBeenCalled();
	});
});
