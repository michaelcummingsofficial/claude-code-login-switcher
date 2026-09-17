import { defineConfig } from "tsup";

export default defineConfig((options) => ({
	entry: ["src/extension.ts"],
	format: ["cjs"],
	platform: "node",
	// VS Code 1.85, the oldest version engines.vscode allows, runs extensions on Node 18.
	target: "node18",
	external: ["vscode"],
	clean: true,
	minify: !options.watch,
	sourcemap: true
}));
