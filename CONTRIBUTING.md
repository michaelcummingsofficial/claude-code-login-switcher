# Contributing

Thank you for considering contributing to `claude-code-login-switcher`.

## Development

1. Clone the repo. It builds and tests on macOS, Linux, and Windows.
2. Install dependencies: `pnpm install`.
3. Open the folder in VS Code and press F5. The **Run Extension** launch configuration builds the extension and opens an Extension Development Host with it loaded.
4. Run `pnpm dev` to rebuild on every save, then run **Developer: Reload Window** in the host to pick up changes.

To try a packaged build in your everyday editor, run `pnpm install-local`. It installs with `code` by default. Set `VSCODE_CLI` to use another editor, for example `VSCODE_CLI=code-insiders pnpm install-local` or `VSCODE_CLI=cursor pnpm install-local`. The script needs a POSIX shell. On Windows, run `pnpm package`, then `code --install-extension claude-code-login-switcher.vsix`.

## Project layout

| Path               | What lives there                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- |
| `src/extension.ts` | Entry point. Registers commands, the status bar, and the sync timer.                |
| `src/commands/`    | One file per Command Palette entry.                                                 |
| `src/credentials/` | Finds and swaps Claude Code's live login: the Keychain item or `.credentials.json`. |
| `src/keychain/`    | macOS only. Reads, writes, and deletes Keychain items through `security`.           |
| `src/profiles/`    | Saved accounts, where each platform keeps them, and token syncing.                  |
| `src/files/`       | Atomic, owner-only file writes.                                                     |
| `src/claude/`      | Finds and runs the `claude` CLI.                                                    |
| `src/settings/`    | Reads the `claudeAccounts.*` settings.                                              |
| `src/statusBar/`   | The status bar item.                                                                |
| `src/workspace/`   | Workspace accounts: a login folder per account, and the redirect that points at it. |
| `test/`            | Tests, mirroring `src/`.                                                            |
| `assets/`          | The Marketplace icon, the status bar logo font, and README images.                  |

Code follows the rules in [`.agents/rules/`](./.agents/rules), which [`CLAUDE.md`](./CLAUDE.md) loads for AI assistants. The short version: one exported function per file, braces on every block, comments only for reasons the code can't show, and no em dashes in user-facing copy.

## Scripts

| Script               | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `pnpm build`         | Bundle `src/` into `dist/extension.js` with tsup.                       |
| `pnpm dev`           | Rebuild on every change.                                                |
| `pnpm lint`          | Run ESLint.                                                             |
| `pnpm format`        | Fix lint issues, then format with Prettier.                             |
| `pnpm typecheck`     | Type-check `src/`, `test/`, and the config files.                       |
| `pnpm test`          | Run the unit tests.                                                     |
| `pnpm test:coverage` | Run the unit tests with coverage. Anything below 100% fails.            |
| `pnpm test:keychain` | Run the integration tests against your real login Keychain. macOS only. |
| `pnpm package`       | Build `claude-code-login-switcher.vsix`.                                |
| `pnpm install-local` | Package and install the `.vsix` into your editor.                       |

## Testing

We use `vitest`. Ensure `pnpm lint`, `pnpm typecheck`, and `pnpm test:coverage` pass before submitting a PR. CI runs all three on Linux, and runs the tests on macOS and Windows too.

- Add tests next to the matching path under `test/`. A bug fix should come with a test that fails without it.
- `vscode` is mocked in `test/mocks/vscode.ts`. Unit tests never touch the real Keychain, Claude Code's real login, or `~/.claude-accounts`. Use `useLiveCredential` for the live login and `createTempStore` for saved accounts.
- Platform-specific code is tested on every OS by pretending with `usePlatform`.
- If you change anything in `src/keychain/`, also run `pnpm test:keychain`. It writes and deletes throwaway items in your login Keychain and never touches Claude Code's own item.

## Release

Bump the version in `package.json` and merge to `main`. CI then:

1. Lints, type-checks, tests, and packages the extension.
2. Publishes the `.vsix` to the VS Code Marketplace and Open VSX.
3. Creates a GitHub release with generated notes and the `.vsix` attached.

A version that already has a GitHub release is skipped. Re-running a failed release is safe, since both registries skip versions they already have.

### One-time setup

These steps are for the maintainer publishing the extension. Neither registry needs a stored token.

1. Create a `production` environment under the repository's settings. The release job runs in it, and both publishing steps are pinned to it. You can require approval there.
2. Create the `michaelcummingsofficial` publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).
3. Set up Microsoft Entra ID for the Marketplace. Register an app in Entra ID, which needs no Azure subscription, and add a federated credential on it for this repository and the `production` environment. Save its application ID as the `AZURE_CLIENT_ID` repository variable and your tenant ID as `AZURE_TENANT_ID`. The app also needs an Azure DevOps profile, which it only gets as a Basic user of an Azure DevOps organization, so add it to one. Then read its profile id from a temporary workflow that signs in with `azure/login` and runs `az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id -o tsv`, since the id is only readable from a token minted as that identity. Add the id as a publisher member with the Contributor role, and confirm with `vsce verify-pat michaelcummingsofficial --azure-credential`. The [publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) covers the Azure Pipelines version of the same flow. Azure DevOps personal access tokens stop working on December 1, 2026.
4. Sign in to [open-vsx.org](https://open-vsx.org), sign the Eclipse publisher agreement, and create an access token. Claim the namespace once with `pnpm exec ovsx create-namespace michaelcummingsofficial -p <token>` and get the ownership claim approved. A trusted publisher is registered per extension and the extension has to exist first, so publish the current version by hand with `pnpm exec ovsx publish claude-code-login-switcher.vsix -p <token>`. Then register a trusted publisher at [open-vsx.org/user-settings/trusted-publishers](https://open-vsx.org/user-settings/trusted-publishers) for this repository, `release.yml`, and the `production` environment, and revoke the token. Every release after that federates.
5. Save a Vercel AI Gateway key as the `AI_GATEWAY_API_KEY` secret. It writes the release notes, and it is the only secret the release needs.
6. Turn on private vulnerability reporting under the repository's security settings, so the link in `SECURITY.md` works.
