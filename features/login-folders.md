# Workspace login folders: stop stranding history and killing logins

Status: built Nov 13, 2026 (v1.5.0), revised after the live test. Not committed yet.

## What happened (Nov 12 to 13, 2026, from Claude Code's extension logs and the Keychain)

With `claudeAccounts.switchScope` set to `workspace`, one account was live in two places at once: the shared Keychain item and the item of its login folder under `~/.claude-accounts/logins/<id>`. Claude Code refreshes each item on its own, and every refresh retires the previous refresh token. Whichever copy refreshed second then failed with `OAuth refresh token is no longer valid; run /login`. That happened at 16:27 and 16:41 on Nov 12, at 00:37 on Nov 13, and again at 08:39 and 08:51, each one a forced sign-in.

At 00:11 on Nov 13 the account was logged in to again and saved under a new id. The old profile's folder was deleted while nine windows still ran Claude Code inside it. Those sessions recreated the folder as a plain directory with no links. From then on that folder had its own `.claude.json` with no login, its own `projects/` and `file-history/`, and Claude Code wrote the plugin marketplace's `installLocation` into the shared `~/.claude/plugins/known_marketplaces.json` using that folder's path. `installed_plugins.json` had pointed into a login folder deleted on Oct 13 ever since. Every window, on every account, then logged `corrupted installLocation` and failed to load the Vercel plugin.

Twenty workspaces kept a persisted `CLAUDE_CONFIG_DIR` pointing at login folders, most of them gone, and kept opening to a sign-in screen.

The local state was repaired by hand on Nov 13 (transcripts merged back, orphan folder archived under `~/.claude-accounts/removed/`, manifests re-pointed, pins cleared, scope set to `global`). This plan is about the extension.

## Root causes

1. One account can be live in two config folders. Claude Code's refresh-token rotation makes that fatal for one of them within hours. `isSuperseded` copies the newer tokens around afterwards, which only resets the race.
2. A login folder is deleted while sessions still use it. Claude Code recreates it without links, forking the config and stranding history. `ensureLoginDir` then ignores the fork, because `link` treats an existing real entry as success.
3. Claude Code writes absolute paths based on the config folder it sees. With `plugins/` linked, those paths land in the shared manifests and dangle once the folder goes.
4. A workspace's pin outlives its account. `restoreWorkspaceAccount` redirects to any folder that exists, saved or not.
5. `syncActiveAccount` writes any live login into the active profile, so a sign-in made outside the extension is saved under whichever account was active.

## Changes

One account, one live login. In workspace scope the shared login is the saved account `profiles.json` names as active. A workspace that picks that account follows the shared login instead of getting a folder, so the account exists in exactly one Keychain item. Other accounts keep one folder each.

- `src/profiles/ProfileStore.ts`: add `sharedId()`, the shared login's account, as opposed to `activeId()`, which answers with the window's workspace account when redirected.
- `src/workspace/useWorkspaceAccount.ts`: when `id` is the shared account, drop the redirect. If a folder for it exists, write the newest of its login, the saved copy, and the shared login into the shared login, then remove the folder. Keep the existing seeding logic for other accounts.
- `src/commands/switchAccount.ts`: in workspace scope, compare the pick against `workspaceAccountId ?? sharedId`, so picking the shared account in an unpinned workspace is a no-op and the picker copy says it follows the shared login.

Never fork a folder. Treat a real entry where a link belongs as something to bring home.

- New `src/workspace/salvageLoginDir.ts`: for every non-link entry in a login folder, move it into the shared folder; recurse into folders that exist on both sides; a file that exists on both sides is parked under `~/.claude-accounts/removed/<id>/` rather than overwritten. `.credentials.json` and `*.lock` stay. Returns whether the folder is clean.
- `src/workspace/ensureLoginDir.ts`: call it before linking, replacing `adopt`. A folder Claude Code recreated is healed the next time it is used.
- `src/workspace/removeLoginDir.ts`: salvage first, then delete the Keychain item and the folder. Removing an account can no longer lose history.

Leave no dangling paths behind.

- New `src/workspace/repointPluginPaths.ts`: rewrite `<store>/logins/<id>/` prefixes in the shared `plugins/known_marketplaces.json` and `plugins/installed_plugins.json` to the shared folder. The link makes both spellings the same files. Run it from `removeLoginDir` and at activation.

Pins only for saved accounts.

- `src/workspace/restoreWorkspaceAccount.ts`: read the profile list before redirecting. Redirect only when the pinned id is saved and is not the shared account. `rememberWorkspaceAccount` already clears the pin otherwise.
- `src/workspace/removeAbandonedLoginDirs.ts`: also collapse the shared account's own folder through `useWorkspaceAccount`, and run `repointPluginPaths`. Keep the one-hour rule for unsaved folders.

Sync only what belongs to the account.

- `src/profiles/syncActiveAccount.ts`: a live login that is a later sign-in than the saved copy (`isLaterLogin`) did not come from the extension. Clear the shared active account instead of saving it, so the status bar shows "unsaved" and `Save Current Account` matches it by email. Same-sign-in refreshes sync as today.

## Tests

Every change ships with tests under the mirrored path, coverage held at 100%:

- `salvageLoginDir`: moves new files home, merges nested folders, parks a colliding file, leaves links and the login alone, reports a folder it could not empty.
- `ensureLoginDir`: heals a recreated folder (real `projects/`, real `.claude.json`) into links with the history moved home.
- `removeLoginDir`: salvages before deleting; repoints the manifests.
- `repointPluginPaths`: rewrites both manifests, leaves other paths alone, tolerates missing files.
- `useWorkspaceAccount`: the shared account gets no folder; an existing folder for it is collapsed with the newest tokens winning.
- `restoreWorkspaceAccount`: an unsaved pin and a pin on the shared account both fall back to the shared login and clear the pin.
- `removeAbandonedLoginDirs`: collapses the shared account's folder, repoints manifests.
- `syncActiveAccount`: a later sign-in from outside clears the active account and leaves the saved copy alone.
- `switchAccount`: picking the shared account in an unpinned workspace does nothing.

A dry run of `salvageLoginDir` and `repointPluginPaths` against the archived copy of the real orphan folder, bundled with esbuild, before the release.

## Docs

- README: Workspace accounts, Shared between workspaces, Abandoned logins, the FAQ on per-repo accounts and on `claude auth login` in a terminal, Privacy and security (what a removed folder leaves behind, where parked files go).
- `package.json`: `switchScope` enum description.
- Version 1.5.0.

## Added after approval: use an account everywhere

- New command `Claude Accounts: Use Account Everywhere`, also an entry in the switch picker when the scope is per workspace. It makes the account the shared login, writes `everywhereAt` into `profiles.json`, and folds away any folder the account had.
- `rememberWorkspaceAccount` records in `workspaceState` when the workspace picked its own account. `isPinOutdated` compares the two. `restoreWorkspaceAccount` drops an outdated pick at startup, and a window drops it when it regains focus, restarting Claude Code.
- A switch with the scope set to `global` stamps `everywhereAt` too, which closes the case of a global switch to an account another workspace has its own folder for.

## Revised after testing: folders are never deleted

The live test on Nov 13 showed deleting a folder that a running session still used recreated it (stranding a transcript line) and left that session holding the shared login's refresh token. So:

- No folder is ever deleted. `removeLoginDir`, `removeAbandonedLoginDirs` and `repointPluginPaths` are gone. `healLoginDirs` relinks and salvages every folder at startup.
- Each account's login lives in one place. "Use Account Everywhere" records `{ id, at }` and points workspaces at that account's own login; it copies no tokens and doesn't move the shared login, so a window already on it doesn't restart.
- Log In Again signs in where the account's login lives. A new account uses `pendingLoginId`, kept for the next try when cancelled.
- Salvage appends missing lines to a transcript found in both places instead of parking it.
- Redirects update VS Code's terminal environment immediately, so the login terminal lands where the window points.

## Not in this plan

- Removing workspace scope. It stays, with one account living in one place.
- Clearing other workspaces' pins from one window. VS Code only exposes the current workspace's collection, so stale pins clear as each workspace opens.
- Claude Code's own behavior: writing absolute paths and recreating a deleted config folder are its choices. The extension works around both.

## Verification before "done"

- `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:keychain` on macOS.
- Install the `.vsix` into VS Code Insiders, enable it, switch scope to workspace, add a second account, pin it to one repo, remove it, and confirm: the other repo's history is untouched, no `logins/` folder is left, the manifests still point into `~/.claude`, and no `corrupted installLocation` line appears in the Claude Code output log.
