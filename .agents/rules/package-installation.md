When installing dependencies, you must strictly adhere to the dependency types. We use pnpm as the package manager.

- Development dependencies only. tsup bundles everything the extension imports into `dist/extension.js`, and `vsce` packages with `--no-dependencies`. tsup also leaves anything listed under `dependencies` out of the bundle, so a runtime package installed there breaks the published extension. Always install with `-D`.
- Never install the `vscode` package. VS Code provides the module at runtime, `@types/vscode` provides its types, and tsup marks it external.
- Keep `@types/vscode` pinned to the version `engines.vscode` names. A newer one lets code call APIs that older supported editors lack, and `vsce` refuses to package it.

pnpm blocks package lifecycle scripts by default. If a package needs its postinstall build step (like esbuild's native binary), add it to `allowBuilds` in `pnpm-workspace.yaml`.
