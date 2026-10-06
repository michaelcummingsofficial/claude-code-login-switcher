import { vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

const disposable = () => ({ dispose: vi.fn() });

export const StatusBarAlignment = { Left: 1, Right: 2 };

export const QuickPickItemKind = { Separator: -1, Default: 0 };

export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };

export const window = {
	createStatusBarItem: vi.fn<AnyFunction>(() => ({
		text: "",
		tooltip: undefined,
		command: undefined,
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn()
	})),
	createTerminal: vi.fn<AnyFunction>(() => ({ show: vi.fn(), sendText: vi.fn(), dispose: vi.fn() })),
	onDidChangeWindowState: vi.fn<AnyFunction>(disposable),
	showErrorMessage: vi.fn<AnyFunction>(async () => undefined),
	showInformationMessage: vi.fn<AnyFunction>(async () => undefined),
	showInputBox: vi.fn<AnyFunction>(async () => undefined),
	showQuickPick: vi.fn<AnyFunction>(async () => undefined),
	showWarningMessage: vi.fn<AnyFunction>(async () => undefined)
};

export const commands = {
	registerCommand: vi.fn<AnyFunction>(disposable)
};

export const workspace = {
	getConfiguration: vi.fn<AnyFunction>(() => ({ get: (_key: string, fallback: unknown) => fallback, inspect: () => undefined, update: vi.fn() })),
	onDidChangeConfiguration: vi.fn<AnyFunction>(disposable)
};
