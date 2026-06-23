/**
 * The contract every sync backend implements. Keeping this surface tiny means
 * the rest of the app only ever pushes and pulls an opaque encrypted blob; it
 * never learns anything about the transport or where the bytes land.
 */
export interface SyncProvider {
  isEnabled(): boolean;
  push(encrypted: string): Promise<void>;
  pull(): Promise<string | null>;
}
