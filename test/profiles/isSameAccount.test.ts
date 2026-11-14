import { describe, expect, it } from "vitest";
import { isSameAccount } from "../../src/profiles/isSameAccount";

const work = { id: "work", label: "Work", email: "ada@work.com", orgName: "Acme", savedAt: 0 };

describe("isSameAccount", () => {
	it("matches an email in any case", () => {
		expect(isSameAccount(work, { loggedIn: true, email: "Ada@Work.com", orgName: "Acme" })).toBe(true);
		expect(isSameAccount(work, { loggedIn: true, email: "ada@home.com", orgName: "Acme" })).toBe(false);
	});

	it("keeps one email's personal plan and Team organization apart", () => {
		expect(isSameAccount(work, { loggedIn: true, email: "ada@work.com", orgName: "Other" })).toBe(false);
	});

	it("matches on the email alone when either side has no organization", () => {
		expect(isSameAccount({ ...work, orgName: undefined }, { loggedIn: true, email: "ada@work.com", orgName: "Other" })).toBe(true);
		expect(isSameAccount(work, { loggedIn: true, email: "ada@work.com" })).toBe(true);
	});
});
