Every change ships with its tests. Coverage is held at 100% for statements, branches, functions, and lines, and `pnpm test:coverage` fails below that.

- Tests mirror `src/`: `src/keychain/readSecret.ts` → `test/keychain/readSecret.test.ts`.
- A bug fix starts with a test that fails without the fix.
- Name tests for the behavior they lock down: "keeps a sync during the login from overwriting the previous account", not "works".

## Mocks

- `vscode` resolves to `test/mocks/vscode.ts` through `vitest.config.mts`. Extend that mock when code uses a new API.
- Unit tests never touch the real Keychain, Claude Code's real login, or `~/.claude-accounts`. For the live login, `vi.mock` `src/credentials/resolveLiveCredential` and back it with `useLiveCredential`. For saved accounts, build stores with `createTempStore`, which uses an in-memory vault.
- Mock a module's collaborators, not the module under test. Prefer a real `ProfileStore` in a temp directory over a mocked one.

## Platforms

- Cover every platform branch on every OS: switch with `usePlatform`, and `test/setup.ts` restores the real platform after each test.
- Build expected paths with `path.join` and read `path.delimiter`, never hard-coded separators, so the same test passes on Windows.
- Skip only what an OS cannot do, with `it.skipIf`: file modes on Windows, shell scripts on Windows. CI runs the suite on macOS, Linux, and Windows, and enforces coverage on Linux.

## The real Keychain

`test/integration/` runs against the login Keychain, only on macOS, and only through `pnpm test:keychain`. Run it after any change in `src/keychain/`. It uses throwaway service names and deletes what it creates.
