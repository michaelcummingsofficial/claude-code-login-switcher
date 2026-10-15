import * as vscode from "vscode";
import { getSettings, type Settings } from "../settings/getSettings";
import { updateSetting } from "../settings/updateSetting";

const scopes: { scope: Settings["switchScope"]; label: string; detail: string }[] = [
	{ scope: "global", label: "One account everywhere", detail: "A switch changes the login in every workspace and terminal." },
	{
		scope: "workspace",
		label: "One account per workspace",
		detail: "A switch changes this workspace only. History, settings, and MCP servers stay shared."
	}
];

export async function changeSwitchScope(): Promise<void> {
	const current = getSettings().switchScope;
	const picked = await vscode.window.showQuickPick(
		scopes.map((item) => ({ ...item, label: item.scope === current ? `$(check) ${item.label}` : item.label })),
		{ title: "Where a switch applies" }
	);
	if (!picked || picked.scope === current) {
		return;
	}

	await updateSetting("switchScope", picked.scope);
}
