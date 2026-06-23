import { flags } from "@/lib/config";
import type { SyncProvider } from "./provider";
import { NoOpSync } from "./noop";

/**
 * Returns the active sync provider. When sync is disabled the NoOpSync is
 * returned immediately and no provider code is ever loaded.
 *
 * The dynamic-import structure below is intentional: some real adapters touch
 * configuration at module-evaluation time and would throw during a build with
 * no env vars set. Guarding the import behind flags.syncEnabled keeps that code
 * completely dark unless an operator has opted in. A future adapter would slot
 * in as `const { SomeAdapter } = await import("./adapters/some-adapter");`
 * right here. v1 ships no adapter, so the enabled branch also falls back to the
 * no-op for now.
 */
export async function getSyncProvider(): Promise<SyncProvider> {
  if (!flags.syncEnabled) {
    return new NoOpSync();
  }

  return new NoOpSync();
}
