import * as Comlink from "comlink";
import type { Embedder } from "@/engine/types";
import type { EmbedderApi } from "./embedding.worker";

export type EmbedderBackend = "webgpu" | "wasm" | "unavailable";

export interface WorkerEmbedder extends Embedder {
  ready(): Promise<{ backend: EmbedderBackend }>;
  dispose(): void;
}

/**
 * Spins up the embedding worker and returns a typed proxy to it. When workers
 * are unavailable (server render, unsupported runtime) this returns a safe
 * no-op embedder so the engine simply runs in sequence-only mode.
 */
export function createEmbedder(): WorkerEmbedder {
  if (typeof Worker === "undefined") {
    return {
      async embed() {
        return [];
      },
      async ready() {
        return { backend: "unavailable" };
      },
      dispose() {},
    };
  }

  const worker = new Worker(new URL("./embedding.worker.ts", import.meta.url), {
    type: "module",
  });
  const api = Comlink.wrap<EmbedderApi>(worker);

  return {
    embed: (texts) => api.embed(texts),
    ready: async () => {
      try {
        return await api.ready();
      } catch {
        return { backend: "unavailable" };
      }
    },
    dispose: () => worker.terminate(),
  };
}
