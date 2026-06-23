import { describe, it, expect } from "vitest";
import { cosine, SemanticIndex } from "./semantic";
import type { Embedder } from "./types";

const fake: Embedder = {
  async embed(texts) {
    const table: Record<string, number[]> = {
      "git push": [1, 0, 0],
      "git push origin main": [0.96, 0.1, 0],
      "npm run build": [0, 1, 0],
      ls: [0, 0, 1],
    };
    return texts.map((t) => Float32Array.from(table[t] ?? [0.3, 0.3, 0.3]));
  },
};

describe("semantic", () => {
  it("cosine of identical vectors is ~1", () => {
    expect(cosine(Float32Array.from([1, 0, 0]), Float32Array.from([1, 0, 0]))).toBeCloseTo(1);
  });

  it("cosine handles a zero vector without NaN", () => {
    expect(cosine(Float32Array.from([0, 0, 0]), Float32Array.from([1, 0, 0]))).toBe(0);
  });

  it("recall returns the nearest stored command by intent", async () => {
    const idx = new SemanticIndex(fake);
    await idx.add("git push");
    await idx.add("npm run build");
    await idx.add("ls");
    const out = await idx.recall("git push origin main", 1);
    expect(out[0]!.command).toBe("git push");
    expect(out[0]!.source).toBe("semantic");
  });

  it("serializes and reloads vectors", async () => {
    const idx = new SemanticIndex(fake);
    await idx.add("git push");
    const reloaded = SemanticIndex.load(idx.serialize(), fake);
    const out = await reloaded.recall("git push origin main", 1);
    expect(out[0]!.command).toBe("git push");
  });
});
