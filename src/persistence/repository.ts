import { openDB, type IDBPDatabase } from "idb";
import type { SerializedModel } from "@/engine/types";
import {
  DB_NAME,
  DB_VERSION,
  STORE_KV,
  KEY_MODEL,
  KEY_SETTINGS,
  DEFAULT_SETTINGS,
  type Settings,
  type PersistedState,
} from "./schema";

// A persisted model carries its own write timestamp so the caller controls
// what "now" means (and tests stay deterministic).
interface StoredModel {
  model: SerializedModel;
  updatedAt: number;
}

// The backend abstraction lets us swap a real IndexedDB connection for a
// plain in-memory map when the environment has no IndexedDB. Both paths
// expose the same key/value operations against the single "kv" store.
interface Backend {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

class IdbBackend implements Backend {
  constructor(private readonly db: IDBPDatabase) {}

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.get(STORE_KV, key)) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.db.put(STORE_KV, value, key);
  }

  async clear(): Promise<void> {
    await this.db.clear(STORE_KV);
  }
}

class MemoryBackend implements Backend {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.map.has(key)) return undefined;
    // Clone so callers can't mutate our stored copy, matching the
    // structured-clone semantics of a real IndexedDB read.
    return clone(this.map.get(key)) as T;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, clone(value));
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export class Repository {
  private constructor(private readonly backend: Backend) {}

  static async open(): Promise<Repository> {
    if (typeof indexedDB === "undefined") {
      return new Repository(new MemoryBackend());
    }

    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_KV)) {
          database.createObjectStore(STORE_KV);
        }
      },
    });

    return new Repository(new IdbBackend(db));
  }

  async saveModel(model: SerializedModel, updatedAt: number): Promise<void> {
    const stored: StoredModel = { model, updatedAt };
    await this.backend.put(KEY_MODEL, stored);
  }

  async loadModel(): Promise<SerializedModel | null> {
    const stored = await this.backend.get<StoredModel>(KEY_MODEL);
    return stored ? stored.model : null;
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.backend.put(KEY_SETTINGS, s);
  }

  async loadSettings(): Promise<Settings> {
    const stored = await this.backend.get<Settings>(KEY_SETTINGS);
    return stored ?? { ...DEFAULT_SETTINGS };
  }

  async clear(): Promise<void> {
    await this.backend.clear();
  }

  // Convenience snapshot used by the export/import path. Not strictly part
  // of the storage contract, but handy for the serializer round-trip.
  async snapshot(): Promise<PersistedState | null> {
    const model = await this.loadModel();
    if (model === null) return null;
    const stored = await this.backend.get<StoredModel>(KEY_MODEL);
    const settings = await this.loadSettings();
    return { model, settings, updatedAt: stored ? stored.updatedAt : 0 };
  }
}
