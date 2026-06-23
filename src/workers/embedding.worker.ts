import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";
import * as Comlink from "comlink";

// Everything is served from our own origin: the model weights from /models and
// the ONNX runtime binary from /ort. Nothing is fetched from a third-party CDN.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
const wasmBackend = env.backends?.onnx?.wasm;
if (wasmBackend) {
  wasmBackend.wasmPaths = "/ort/";
  // We deliberately avoid cross-origin isolation, so multi-threaded WASM is off.
  wasmBackend.numThreads = 1;
}

// transformers.js exposes a very large overloaded signature for `pipeline`;
// narrow it to the one shape we use so type-checking stays tractable.
const buildPipeline = pipeline as unknown as (
  task: "feature-extraction",
  model: string,
  options: { dtype: string; device: "webgpu" | "wasm" },
) => Promise<FeatureExtractionPipeline>;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractor: FeatureExtractionPipeline | null = null;
let backend: "webgpu" | "wasm" = "wasm";

async function init(): Promise<{ backend: "webgpu" | "wasm" }> {
  if (extractor) return { backend };

  const nav = (globalThis as unknown as { navigator?: { gpu?: { requestAdapter(): Promise<unknown> } } })
    .navigator;
  try {
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) backend = "webgpu";
    }
  } catch {
    backend = "wasm";
  }

  extractor = await buildPipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
    device: backend,
  });
  return { backend };
}

const api = {
  async ready(): Promise<{ backend: "webgpu" | "wasm" }> {
    return init();
  },

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    await init();
    const tensor = (await extractor!(texts, {
      pooling: "mean",
      normalize: true,
    })) as { dims: number[]; data: Float32Array };

    const rows = tensor.dims[0] ?? 0;
    const dim = tensor.dims[tensor.dims.length - 1] ?? 0;
    const out: Float32Array[] = [];
    for (let i = 0; i < rows; i++) {
      out.push(tensor.data.slice(i * dim, (i + 1) * dim));
    }
    return out;
  },
};

export type EmbedderApi = typeof api;

Comlink.expose(api);
