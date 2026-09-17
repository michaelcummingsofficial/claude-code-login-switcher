One exported function per file, named exactly after the function: `readSecret` → `src/keychain/readSecret.ts`, `switchAccount` → `src/commands/switchAccount.ts`. A class follows the same rule under its own name: `ProfileStore` → `src/profiles/ProfileStore.ts`.

- Private helpers may stay unexported in the same file. When a second file needs one, give it its own file.
- Types that describe the function's input or output are exported beside it, like `AuthStatus` next to `readAuthStatus`.
- No barrel files. Import from the function's own path.
- Group by domain in a folder (`src/keychain/`, `src/profiles/`), still one function per file.

## The entry point

`src/extension.ts` is the one exception. VS Code requires it to export both `activate` and `deactivate`. Keep it to wiring: commands, the status bar, and the sync timer. Behavior belongs in a command or a domain function.

## Commands

Each Command Palette entry is one function in `src/commands/` that takes the `ProfileStore`:

```typescript
export async function renameAccount(store: ProfileStore): Promise<void> {
	const profile = await pickSavedProfile(store, "Rename a saved Claude account");
	if (!profile) {
		return;
	}

	const label = await promptForLabel("Rename account", profile.label);
	if (!label) {
		return;
	}

	await store.update(profile.id, { label });
}
```

- Register it in the `commands` map in `src/extension.ts` and in `contributes.commands` in `package.json`. A test fails when the two disagree.
- Don't refresh the status bar or catch errors just to show them. The wrapper in `src/extension.ts` does both after every command.
- Never interpolate a token, a raw credential, or a `child_process` error's `message` into anything shown or logged. That message repeats the command line. Wrap failures in `KeychainError` instead.
