import type { SerializedModel } from "@/engine/types";

export const DB_NAME = "shadow-agent";
export const DB_VERSION = 1;

// Single object store. It has no keyPath; callers supply explicit keys.
export const STORE_KV = "kv";

// Well-known keys inside the kv store.
export const KEY_MODEL = "model";
export const KEY_SETTINGS = "settings";

export interface Settings {
  pauseLearning: boolean;
  reduceMotion: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  pauseLearning: false,
  reduceMotion: false,
  onboarded: false,
};

export interface PersistedState {
  model: SerializedModel;
  settings: Settings;
  updatedAt: number;
}
