Default to no comment. A comment is a line the reader has to check against the code, and one that goes stale silently. Write one only when it carries something the code cannot.

## Earns a comment

- The reason is invisible: The what is clear; the why isn't. A `security` CLI quirk, Claude Code's internals, an ordering constraint, a bug this shape prevents.
- Load-bearing and fragile: Deleting this breaks something a reader wouldn't connect to it. Say what breaks and how to check.
- The obvious approach was rejected: Someone will try to simplify it back. Say why that fails here.
- Genuinely hard context: Non-trivial math, a protocol detail, a format nobody should be expected to know.

Nothing else. If none apply, ship the code bare.

## Doesn't

- The line already says it. `statusBar.hide()` needs no note that the status bar is hidden.
- Citing the rule you followed: lint rules, VS Code API conventions.
- Structure labels: `// Handlers`, `// Helpers`, `// Constants`.
- Restating a good name. If `syncActiveAccount` needs "syncs the active account", the comment is the redundant half.
- Narrating the change: `// added`, `// was previously`. Git has that.
- Anything a rename or an extraction fixes better. Try that first.

## Shape

- One or two lines. Longer means the code needs restructuring, not prose.
- A single line uses `//`. Anything longer uses a block, never stacked `//`:

```typescript
/**
 * Claude Code rotates the tokens in place, so the copy saved for the active
 * account goes stale within the hour.
 */
```

- Give the reason, not the mechanics.
- Put it at the surprise, not the top of the file.
- TSDoc only when the signature can't carry it: what `null` means, how two parameters interact, a unit, a side effect. Not `/** The profile's label */`.

## Editing existing code

Same bar for new ones. Delete stale comments and commented-out code. Leave invisible-reason comments alone.
