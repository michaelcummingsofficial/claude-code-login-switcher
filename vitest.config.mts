import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// VS Code injects the `vscode` module at runtime, and there is no package to install for tests.
		alias: { vscode: fileURLToPath(new URL("./test/mocks/vscode.ts", import.meta.url)) }
	},
	test: {
		include: ["test/**/*.test.ts"],
		setupFiles: ["test/setup.ts"],
		mockReset: true,
		restoreMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			reporter: ["text", "html", "lcov"],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100
			}
		}
	}
});
