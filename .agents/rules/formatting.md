Braces always, and the body goes on its own line. This includes guard clauses, the case most often written inline:

```typescript
const live = await readSecret(settings.keychainService);
if (!live) {
	return null;
}

const existing = await detectActiveProfile(store, live);
return existing;
```

Never `if (!live) return null;`. The same applies to `throw`, `continue`, `break`, and single-statement loops.

Inside a function body the only blank line is the one after a block's closing brace, separating the guard from the work it protects. Nothing else gets one: not before the guard, not before the final `return`. Statements run flush.

The import block is one block. Imports run flush against each other, with a single blank line after the last one. Copied-in code that groups its imports with blank lines gets collapsed.

Everything else at the top level is untouched, so exports, interfaces, types, and declarations keep whatever spacing reads best.

`curly` and `padding-line-between-statements` in `eslint.config.ts` enforce it, and `pnpm format` rewrites offenders.
