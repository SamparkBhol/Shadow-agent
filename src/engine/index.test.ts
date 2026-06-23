import { describe, it, expect } from "vitest";
import { Engine } from "./index";
import type { Embedder } from "./types";

// Deterministic pseudo-embedder: stable, no clock or randomness.
const fakeEmbedder: Embedder = {
  async embed(texts) {
    return texts.map((t) => {
      const v = new Float32Array(8);
      for (let i = 0; i < t.length; i++) {
        const idx = i % 8;
        v[idx] = (v[idx] ?? 0) + ((t.charCodeAt(i) % 13) + 1);
      }
      return v;
    });
  },
};

const GIT_LOOP = ["git status", "git add .", 'git commit -m "update"', "git push"];

describe("Engine", () => {
  it("predicts the next command after learning a loop", async () => {
    const e = new Engine(fakeEmbedder);
    for (const pass of [0, 1]) for (const c of GIT_LOOP) await e.record(c, pass);
    const out = await e.suggest({ history: ["git add ."], partial: "", topK: 3 });
    expect(out[0]!.command.startsWith("git commit")).toBe(true);
  });

  it("records transitions in the memory graph", async () => {
    const e = new Engine(fakeEmbedder);
    for (const c of GIT_LOOP) await e.record(c, 0);
    const { edges, nodes } = e.graph();
    expect(nodes.some((n) => n.command === "git add .")).toBe(true);
    expect(edges.some((x) => x.from === "git add ." && x.to.startsWith("git commit"))).toBe(true);
  });

  it("works in markov-only mode without an embedder", async () => {
    const e = new Engine();
    for (const c of GIT_LOOP) await e.record(c, 0);
    const out = await e.suggest({ history: ["git add ."], partial: "", topK: 3 });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.command.startsWith("git commit")).toBe(true);
  });

  it("filters suggestions by the partial prefix", async () => {
    const e = new Engine();
    for (const c of GIT_LOOP) await e.record(c, 0);
    const out = await e.suggest({ history: ["git status"], partial: "git a", topK: 3 });
    expect(out.every((s) => s.command.startsWith("git a"))).toBe(true);
  });

  it("round-trips through serialize/load", async () => {
    const e = new Engine(fakeEmbedder);
    for (const c of GIT_LOOP) await e.record(c, 0);
    const model = e.serialize();
    const e2 = new Engine(fakeEmbedder);
    e2.load(model, fakeEmbedder);
    const out = await e2.suggest({ history: ["git add ."], partial: "", topK: 1 });
    expect(out[0]!.command.startsWith("git commit")).toBe(true);
  });
});
