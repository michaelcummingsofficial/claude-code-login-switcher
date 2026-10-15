import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestUsage } from "../../src/usage/requestUsage";
import { UsageMeter } from "../../src/usage/UsageMeter";

vi.mock("../../src/usage/requestUsage");

const NOW = 1_000_000_000_000;
const login = (accessToken: string, expiresAt = NOW + 3_600_000) => JSON.stringify({ claudeAiOauth: { accessToken, expiresAt } });
const usage = (percent: number) => ({ status: 200, body: JSON.stringify({ limits: [{ kind: "session", percent }] }) });
const session = (percent: number) => [{ kind: "session", scope: undefined, percent, resetsAt: undefined }];

let now: number;
let meter: UsageMeter;

function advance(ms: number): void {
	now += ms;
}

describe("UsageMeter", () => {
	beforeEach(() => {
		now = NOW;
		vi.spyOn(Date, "now").mockImplementation(() => now);
		meter = new UsageMeter();
	});

	it("reads the usage of the login it is handed", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(34));
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(34));
		expect(requestUsage).toHaveBeenCalledWith("work-token");
	});

	it("asks again only after two minutes, or straight away for another login", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(34));
		await meter.read(login("work-token"));
		advance(119_000);
		await meter.read(login("work-token"));
		expect(requestUsage).toHaveBeenCalledTimes(1);
		await meter.read(login("personal-token"));
		expect(requestUsage).toHaveBeenCalledTimes(2);
		advance(1_000);
		vi.mocked(requestUsage).mockResolvedValue(usage(40));
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(40));
	});

	it("shares one request between reads that overlap", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(34));
		await Promise.all([meter.read(login("work-token")), meter.read(login("work-token"))]);
		expect(requestUsage).toHaveBeenCalledTimes(1);
	});

	it("leaves an expired token for Claude Code to refresh, and never asks with it", async () => {
		await expect(meter.read(login("stale-token", NOW))).resolves.toBe("expired");
		expect(requestUsage).not.toHaveBeenCalled();
	});

	it.each([["not JSON"], [JSON.stringify({ claudeAiOauth: { expiresAt: NOW + 1 } })]])(
		"knows nothing about a login without a token: %s",
		async (credentials) => {
			await expect(meter.read(credentials)).resolves.toBeNull();
			expect(requestUsage).not.toHaveBeenCalled();
		}
	);

	it("asks with a token that has no expiry recorded", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(5));
		await expect(meter.read(JSON.stringify({ claudeAiOauth: { accessToken: "token" } }))).resolves.toEqual(session(5));
	});

	it("keeps the last figures for the same login when a refresh fails", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(34));
		await meter.read(login("work-token"));
		advance(120_000);
		vi.mocked(requestUsage).mockResolvedValue({ status: 500, body: "" });
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(34));
		advance(120_000);
		vi.mocked(requestUsage).mockRejectedValue(new Error("curl could not reach Anthropic."));
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(34));
	});

	it("reports nothing for a login whose first request fails", async () => {
		vi.mocked(requestUsage).mockResolvedValue({ status: 200, body: "not JSON" });
		await expect(meter.read(login("work-token"))).resolves.toBeNull();
	});

	it("stops asking for that account for five minutes after a rate limit", async () => {
		vi.mocked(requestUsage).mockResolvedValue(usage(34));
		await meter.read(login("work-token"));
		advance(120_000);
		vi.mocked(requestUsage).mockResolvedValue({ status: 429, body: "" });
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(34));
		advance(240_000);
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(34));
		expect(requestUsage).toHaveBeenCalledTimes(2);
		advance(60_000);
		vi.mocked(requestUsage).mockResolvedValue(usage(50));
		await expect(meter.read(login("work-token"))).resolves.toEqual(session(50));
	});

	it("still asks for an account switched to while another one is rate limited", async () => {
		vi.mocked(requestUsage).mockResolvedValue({ status: 429, body: "" });
		await expect(meter.read(login("work-token"))).resolves.toBeNull();
		vi.mocked(requestUsage).mockResolvedValue(usage(12));
		await expect(meter.read(login("personal-token"))).resolves.toEqual(session(12));
	});
});
