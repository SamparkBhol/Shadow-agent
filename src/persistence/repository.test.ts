import { describe, it, expect, beforeEach } from "vitest";
import { Repository } from "./repository";
import { toBlob, fromBlob } from "./serializer";
import { DEFAULT_SETTINGS, type Settings, type PersistedState } from "./schema";
import type { SerializedModel } from "@/engine/types";

function sampleModel(): SerializedModel {
  return {
    version: 1,
    markov: { "git add": { "git commit": 4, "git status": 1 } },
    nodes: [{ id: "n1", command: "git add", freq: 5, lastSeen: 100 }],
    edges: [{ from: "n1", to: "n2", weight: 3 }],
    semantic: { dims: 2, vectors: { "git add": [0.1, 0.9] } },
  };
}

// Each test runs against a freshly wiped database so state can't leak between
// cases (fake-indexeddb persists for the whole module otherwise).
beforeEach(async () => {
  const repo = await Repository.open();
  await repo.clear();
});

describe("Repository", () => {
  it("round-trips a model across a fresh reopen", async () => {
    const model = sampleModel();

    const writer = await Repository.open();
    await writer.saveModel(model, 1234);

    const reader = await Repository.open();
    const loaded = await reader.loadModel();

    expect(loaded).toEqual(model);
  });

  it("returns DEFAULT_SETTINGS before any save, then the saved value", async () => {
    const repo = await Repository.open();

    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);

    const next: Settings = {
      pauseLearning: true,
      reduceMotion: true,
      onboarded: true,
    };
    await repo.saveSettings(next);

    const reopened = await Repository.open();
    expect(await reopened.loadSettings()).toEqual(next);
  });

  it("clear() removes the stored model", async () => {
    const repo = await Repository.open();
    await repo.saveModel(sampleModel(), 42);
    expect(await repo.loadModel()).not.toBeNull();

    await repo.clear();
    expect(await repo.loadModel()).toBeNull();
  });

  it("falls back to an in-memory backend when indexedDB is missing", async () => {
    const original = globalThis.indexedDB;
    try {
      // @ts-expect-error deliberately removing the global for this test
      globalThis.indexedDB = undefined;

      const repo = await Repository.open();
      const model = sampleModel();
      await repo.saveModel(model, 7);

      expect(await repo.loadModel()).toEqual(model);

      const settings: Settings = {
        pauseLearning: true,
        reduceMotion: false,
        onboarded: true,
      };
      await repo.saveSettings(settings);
      expect(await repo.loadSettings()).toEqual(settings);
    } finally {
      globalThis.indexedDB = original;
    }
  });
});

describe("serializer", () => {
  it("round-trips a PersistedState through toBlob/fromBlob", () => {
    const state: PersistedState = {
      model: sampleModel(),
      settings: { pauseLearning: true, reduceMotion: false, onboarded: true },
      updatedAt: 999,
    };

    expect(fromBlob(toBlob(state))).toEqual(state);
  });

  it("throws on non-JSON input", () => {
    expect(() => fromBlob("not json")).toThrow();
  });

  it("throws on a wrong format wrapper", () => {
    expect(() => fromBlob(JSON.stringify({ format: "wrong" }))).toThrow();
  });
});
