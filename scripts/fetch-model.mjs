// Vendors the on-device embedding model and the ONNX runtime binary into
// public/ so the app is fully self-contained: no model or runtime is fetched
// from a third-party CDN at runtime, and nothing about the user's commands
// ever leaves the browser.
//
// Run once after install:  npm run fetch:model

import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const HF_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const modelDir = join(root, "public", "models", MODEL_ID);
const ortDir = join(root, "public", "ort");

// Files transformers.js expects for a feature-extraction (q8) pipeline.
const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
];

// The runtime binary bundled with the installed transformers package.
const ORT_FILES = [
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

function human(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  console.log(`Vendoring ${MODEL_ID} into public/models …`);
  await mkdir(modelDir, { recursive: true });
  let total = 0;
  for (const file of MODEL_FILES) {
    const dest = join(modelDir, file);
    const size = await download(`${HF_BASE}/${file}`, dest);
    total += size;
    console.log(`  ${file}  (${human(size)})`);
  }

  console.log("Copying the ONNX runtime binary into public/ort …");
  await mkdir(ortDir, { recursive: true });
  const distDir = join(root, "node_modules", "@huggingface", "transformers", "dist");
  for (const file of ORT_FILES) {
    const src = join(distDir, file);
    if (!existsSync(src)) {
      console.warn(`  skipped ${file} (not found in installed package)`);
      continue;
    }
    const dest = join(ortDir, file);
    await copyFile(src, dest);
    const { size } = await stat(dest);
    total += size;
    console.log(`  ${file}  (${human(size)})`);
  }

  console.log(`Done. Vendored ${human(total)} total.`);
}

main().catch((err) => {
  console.error("\nFailed to vendor the model:", err.message);
  process.exitCode = 1;
});
