/** Runs the rest of the test as if on `platform`. `test/setup.ts` restores the real one afterwards. */
export function usePlatform(platform: NodeJS.Platform): void {
	Object.defineProperty(process, "platform", { value: platform, configurable: true, enumerable: true, writable: false });
}
