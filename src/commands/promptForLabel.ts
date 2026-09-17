import * as vscode from "vscode";

/** Resolves the trimmed name, or `undefined` when the input box is dismissed. */
export async function promptForLabel(title: string, value: string): Promise<string | undefined> {
	const label = await vscode.window.showInputBox({
		title,
		prompt: "Name this account",
		value,
		validateInput: (input) => (input.trim().length === 0 ? "Enter a name" : undefined)
	});
	return label?.trim() || undefined;
}
