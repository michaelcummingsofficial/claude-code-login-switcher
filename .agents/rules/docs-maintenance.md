Whenever you make a change that touches what a user sees, configures, or trusts, you must update `README.md` in the same session. Leaving it out of sync with the implementation is a bug.

## What counts

| Change       | Examples                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------ |
| Command      | Adding, removing, or renaming an entry in `contributes.commands`                           |
| Setting      | A new or removed setting, a changed default, a changed meaning                             |
| Stored data  | Where tokens or `profiles.json` live on each platform, Keychain service names, permissions |
| Behavior     | When syncs run, what a switch changes, which platforms are supported                       |
| Security     | What reaches argv, stdout, logs, or error messages; what the extension runs or connects to |
| Requirements | `engines.vscode`, the Claude Code CLI, supported platforms                                 |

## What to update

- `README.md`: the Commands and Settings tables, How it works, Privacy and security, and the FAQ.
- `package.json`: command titles and setting descriptions, which follow writing-voice-and-tone.
- `CONTRIBUTING.md`: when scripts, tests, the project layout, or the release process change.

## Rules

- Update docs **before** considering the task done.
- If you remove a feature, delete its documentation entirely. Don't leave stale examples.
- `test/manifest.test.ts` fails when a command or setting is missing from the README. Passing it is the floor, not the goal.
