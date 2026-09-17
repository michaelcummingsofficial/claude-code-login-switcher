import { describe, expect, it } from "vitest";
import { promptForLabel } from "../../src/commands/promptForLabel";
import { window } from "../mocks/vscode";

describe("promptForLabel", () => {
	it("asks for a name with the suggested value and returns it trimmed", async () => {
		window.showInputBox.mockResolvedValue("  Work  ");
		await expect(promptForLabel("Rename account", "Old name")).resolves.toBe("Work");
		expect(window.showInputBox).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Rename account", prompt: "Name this account", value: "Old name" })
		);
	});

	it("rejects blank names while typing", async () => {
		await promptForLabel("Rename account", "");
		const { validateInput } = window.showInputBox.mock.calls[0]![0] as { validateInput: (value: string) => string | undefined };
		expect(validateInput("   ")).toBe("Enter a name");
		expect(validateInput("Work")).toBeUndefined();
	});

	it.each([undefined, "", "   "])("returns undefined for %j", async (input) => {
		window.showInputBox.mockResolvedValue(input);
		await expect(promptForLabel("Rename account", "")).resolves.toBeUndefined();
	});
});
