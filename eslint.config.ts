import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importXPlugin from "eslint-plugin-import-x";
import { defineConfig, globalIgnores, type Config } from "eslint/config";

// The plugin publishes types looser than its runtime shape; the cast keeps tsc's strict check happy.
const tsRecommended = tsPlugin.configs["flat/recommended"] as Config[];

const eslintConfig = defineConfig([
	...tsRecommended,
	{
		plugins: {
			"import-x": importXPlugin
		},
		rules: {
			"curly": ["error", "all"],
			"import-x/first": "error",
			"padding-line-between-statements": [
				"error",
				{ blankLine: "never", prev: "*", next: "block-like" },
				{ blankLine: "never", prev: "*", next: "return" },
				{ blankLine: "always", prev: "block-like", next: "*" },
				{ blankLine: "any", prev: "*", next: "function" },
				{ blankLine: "any", prev: "function", next: "*" },
				{ blankLine: "any", prev: "*", next: "export" },
				{ blankLine: "any", prev: "export", next: "*" },
				{ blankLine: "always", prev: "import", next: "*" },
				{ blankLine: "never", prev: "import", next: "import" },
				{ blankLine: "never", prev: "directive", next: "import" }
			]
		}
	},
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser
		}
	},
	globalIgnores(["dist/**", "coverage/**"])
]);

export default eslintConfig;
