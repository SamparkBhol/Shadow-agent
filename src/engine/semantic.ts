import type { Embedder, Suggestion } from "./types";

/** Cosine similarity of two equal-length vectors. Returns 0 if either is zero. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * A small in-memory vector index over the commands the user has run. Each
 * unique command is embedded once; recall ranks stored commands by how close
 * the current context is to them in meaning, not just in literal text.
 */
export class SemanticIndex {
  private vectors = new Map<string, Float32Array>();

  constructor(private embedder: Embedder) {}

  /** Embed and store a command if it has not been indexed yet. */
  async add(command: string): Promise<void> {
    if (this.vectors.has(command)) return;
    const [vec] = await this.embedder.embed([command]);
    if (vec) this.vectors.set(command, vec);
  }

  /** Return the stored commands most similar in meaning to `context`. */
  async recall(context: string, topK: number): Promise<Suggestion[]> {
    if (this.vectors.size === 0) return [];
    const [query] = await this.embedder.embed([context]);
    if (!query) return [];

    const scored: Suggestion[] = [];
    for (const [command, vec] of this.vectors) {
      const sim = cosine(query, vec);
      scored.push({
        command,
        confidence: (sim + 1) / 2, // map [-1,1] -> [0,1]
        source: "semantic",
        reason: `similar to something you ran (${sim.toFixed(2)})`,
      });
    }
    return scored.sort((a, b) => b.confidence - a.confidence).slice(0, topK);
  }

  get size(): number {
    return this.vectors.size;
  }

  serialize(): unknown {
    return {
      commands: [...this.vectors.keys()],
      vectors: [...this.vectors.values()].map((v) => Array.from(v)),
    };
  }

  static load(data: unknown, embedder: Embedder): SemanticIndex {
    const index = new SemanticIndex(embedder);
    const obj = data as { commands?: string[]; vectors?: number[][] };
    const commands = obj.commands ?? [];
    const vectors = obj.vectors ?? [];
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const vec = vectors[i];
      if (cmd && vec) index.vectors.set(cmd, Float32Array.from(vec));
    }
    return index;
  }
}
