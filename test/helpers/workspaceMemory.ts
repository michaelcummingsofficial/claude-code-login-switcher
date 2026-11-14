import { vi } from "vitest";
import { pickedAtKey } from "../../src/workspace/pickedAtKey";
import type { WorkspaceMemory } from "../../src/workspace/WorkspaceMemory";

export interface FakeWorkspaceMemory extends WorkspaceMemory {
	environment: { get: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
	state: Map<string, unknown>;
}

/** A workspace that remembers the redirect `dir`, picked at `pickedAt`. Both live in plain values tests can read. */
export function workspaceMemory(dir?: string, pickedAt?: number): FakeWorkspaceMemory {
	let value = dir;
	const state = new Map<string, unknown>(pickedAt === undefined ? [] : [[pickedAtKey, pickedAt]]);
	const environment = {
		get: vi.fn(() => (value ? { value } : undefined)),
		replace: vi.fn((_name: string, next: string) => {
			value = next;
		}),
		delete: vi.fn(() => {
			value = undefined;
		})
	};
	return {
		environment,
		state,
		environmentVariableCollection: environment as unknown as WorkspaceMemory["environmentVariableCollection"],
		workspaceState: {
			keys: () => [...state.keys()],
			get: (key: string, fallback?: unknown) => (state.has(key) ? state.get(key) : fallback),
			update: async (key: string, next: unknown) => {
				if (next === undefined) {
					state.delete(key);
				} else {
					state.set(key, next);
				}
			}
		} as WorkspaceMemory["workspaceState"]
	};
}
