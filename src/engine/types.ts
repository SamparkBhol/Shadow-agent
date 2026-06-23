/**
 * Core contracts shared across the prediction engine. This module is pure:
 * it has no React, DOM, IndexedDB, or network dependencies, so it can be
 * imported by both the browser bundle and the Node test runner.
 */

/** A command the user ran, after light normalization. */
export interface CommandRecord {
  raw: string;
  normalized: string;
  ts: number;
}

export type SuggestionSource = "sequence" | "semantic" | "fused";

/** A single ranked prediction surfaced to the UI. */
export interface Suggestion {
  /** The predicted command text. */
  command: string;
  /** Blended confidence in the range 0..1. */
  confidence: number;
  /** Which signal produced (or dominated) this suggestion. */
  source: SuggestionSource;
  /** Human-readable provenance, e.g. "seen 4x after git add". */
  reason: string;
  /** True when the command matches a destructive pattern. */
  risky?: boolean;
}

/**
 * The embedding backend. Injected into the engine so the prediction core can
 * be unit-tested with a deterministic fake, and so the real implementation
 * (a Web Worker running a transformer model) stays out of the pure core.
 */
export interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

/** A request for the next-command suggestions given the current context. */
export interface SuggestRequest {
  /** Recent commands, oldest first. */
  history: string[];
  /** The partially typed current line (may be empty). */
  partial: string;
  /** Maximum number of suggestions to return. */
  topK: number;
}

/** A versioned, serializable snapshot of everything the engine has learned. */
export interface SerializedModel {
  version: number;
  markov: unknown;
  nodes: unknown;
  edges: unknown;
  semantic: unknown;
  /** Engine bookkeeping; optional so consumers can treat the model opaquely. */
  totalTransitions?: number;
  history?: string[];
}

/** A node in the live memory graph (one per unique normalized command). */
export interface GraphNode {
  id: string;
  command: string;
  freq: number;
  lastSeen: number;
}

/** A directed, weighted transition between two commands. */
export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

/** A point-in-time view of the memory graph for visualization. */
export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const MODEL_VERSION = 1;
