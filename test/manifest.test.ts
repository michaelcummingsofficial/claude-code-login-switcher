import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSettings, type Settings } from "../src/settings/getSettings";

interface Manifest {
	main: string;
	icon: string;
	files: string[];
	engines: { vscode: string };
	devDependencies: Record<string, string>;
	contributes: {
		icons: Record<string, { default: { fontPath: string } }>;
		commands: { command: string; title: string; category: string }[];
		configuration: { properties: Record<string, { default: unknown }> };
	};
}

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("package.json")) as Manifest;
const readme = read("README.md");
const settings = Object.entries(manifest.contributes.configuration.properties);

describe("package.json", () => {
	it.each(manifest.contributes.commands)("documents $category: $title in the README", ({ category, title }) => {
		expect(readme).toContain(`\`${category}: ${title}\``);
	});

	it.each(settings)("documents %s in the README", (key) => {
		expect(readme).toContain(`\`${key}\``);
	});

	it.each(settings)("gives %s the same default as the code", (key, { default: fallback }) => {
		const name = key.replace("claudeAccounts.", "");
		if (name === "keychainService" || name === "claudeConfigDir") {
			// Empty means "derive it from Claude Code's own rules", which getSettings resolves.
			expect(fallback).toBe("");
			return;
		}

		expect(getSettings()[name as keyof Settings]).toBe(fallback);
	});

	it("pins @types/vscode to the oldest supported VS Code, so newer APIs can't slip in", () => {
		expect(manifest.devDependencies["@types/vscode"]).toBe(manifest.engines.vscode.replace("^", "~"));
	});

	it("contributes the status bar logo and packages its font", () => {
		const logo = manifest.contributes.icons["claude-account-switcher-logo"];
		expect(logo).toBeDefined();
		expect(manifest.files).toContain(logo!.default.fontPath);
	});

	it("packages the bundle VS Code loads and the Marketplace icon", () => {
		expect(manifest.files).toContain(manifest.main.replace(/^\.\//, ""));
		expect(manifest.files).toContain(manifest.icon);
	});
});
