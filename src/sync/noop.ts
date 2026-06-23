import type { SyncProvider } from "./provider";

/**
 * The default provider when sync is switched off. It satisfies the interface
 * without touching the network, so callers can stay oblivious to whether sync
 * is configured.
 */
export class NoOpSync implements SyncProvider {
  isEnabled(): boolean {
    return false;
  }

  async push(_encrypted: string): Promise<void> {
    // Nothing leaves the device when sync is disabled.
  }

  async pull(): Promise<string | null> {
    return null;
  }
}
