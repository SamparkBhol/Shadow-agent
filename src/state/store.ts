import { createStore } from "zustand/vanilla";
import type { Engine } from "@/engine";
import type { GraphSnapshot, Suggestion } from "@/engine/types";
import type { Shell, RunResult } from "@/sandbox/shell";
import type { Repository } from "@/persistence/repository";
import type { Settings } from "@/persistence/schema";
import { DEFAULT_SETTINGS } from "@/persistence/schema";
import { toBlob, fromBlob } from "@/persistence/serializer";
import type { EmbedderBackend } from "@/workers/embedder-client";

export interface StoreDeps {
  engine: Engine;
  shell: Shell;
  repo: Repository;
  /** Injectable clock so tests stay deterministic. */
  now?: () => number;
  /** Debounce window for the async semantic refine, in ms. */
  refineDelay?: number;
}

export interface Stats {
  commands: number;
  patterns: number;
  topConfidence: number;
  maturity: number;
}

export interface Status {
  backend: EmbedderBackend | "loading";
  modelLoading: boolean;
}

export interface AppState {
  ready: boolean;
  prompt: string;
  partial: string;
  history: string[];
  suggestions: Suggestion[];
  graph: GraphSnapshot;
  stats: Stats;
  status: Status;
  settings: Settings;

  hydrate: () => Promise<void>;
  runCommand: (line: string) => Promise<RunResult>;
  setPartial: (partial: string) => void;
  accept: (command: string) => void;
  reject: (command: string) => void;
  reset: () => Promise<void>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setStatus: (status: Partial<Status>) => void;
  exportModel: () => string;
  importModel: (blob: string) => Promise<void>;
}

const TOP_K = 4;

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: StoreDeps) {
  const { engine, shell, repo } = deps;
  const now = deps.now ?? (() => Date.now());
  const refineDelay = deps.refineDelay ?? 120;

  return createStore<AppState>((set, get) => {
    let refineTimer: ReturnType<typeof setTimeout> | null = null;
    let refineToken = 0;

    // Cheap, runs on every keystroke: recompute suggestions + stats only.
    // The graph reference is left untouched so the canvas doesn't re-lay-out.
    const recompute = () => {
      const { history, partial, graph } = get();
      const suggestions = engine.suggestSync({ history, partial, topK: TOP_K });
      set({
        suggestions,
        stats: {
          commands: history.length,
          patterns: graph.edges.length,
          topConfidence: suggestions[0]?.confidence ?? 0,
          maturity: engine.maturity(),
        },
      });
    };

    // Rebuilds the graph snapshot. Only the graph actually changes here, so this
    // runs on command/reset/load — not on every keystroke.
    const refreshGraph = () => {
      set({ graph: engine.graph() });
    };

    const refineNow = async (token: number) => {
      const { history, partial } = get();
      const refined = await engine.suggest({ history, partial, topK: TOP_K });
      const cur = get();
      // Drop the result if a newer request started or the context moved on.
      if (token === refineToken && cur.history === history && cur.partial === partial) {
        set({ suggestions: refined });
      }
    };

    const scheduleRefine = () => {
      if (refineTimer) clearTimeout(refineTimer);
      const token = ++refineToken;
      const timer = setTimeout(() => void refineNow(token), refineDelay);
      // Don't let a pending refine keep a Node process (e.g. tests) alive.
      (timer as { unref?: () => void }).unref?.();
      refineTimer = timer;
    };

    const persist = async () => {
      try {
        await repo.saveModel(engine.serialize(), now());
      } catch {
        // Durable storage is best-effort; the app stays usable without it.
      }
    };

    return {
      ready: false,
      prompt: shell.prompt,
      partial: "",
      history: [],
      suggestions: [],
      graph: { nodes: [], edges: [] },
      stats: { commands: 0, patterns: 0, topConfidence: 0, maturity: 0 },
      status: { backend: "loading", modelLoading: true },
      settings: { ...DEFAULT_SETTINGS },

      async hydrate() {
        const [model, settings] = await Promise.all([repo.loadModel(), repo.loadSettings()]);
        if (model) engine.load(model);
        // Restore the engine's recent context so predictions work immediately.
        set({ settings, ready: true, history: engine.getHistory() });
        refreshGraph();
        recompute();
      },

      async runCommand(line: string) {
        const result = shell.run(line);
        const trimmed = line.trim();
        if (trimmed && trimmed !== "clear" && !get().settings.pauseLearning) {
          await engine.record(trimmed, now());
          set((s) => ({ history: [...s.history, trimmed] }));
        }
        set({ partial: "", prompt: shell.prompt });
        refreshGraph();
        recompute();
        scheduleRefine();
        void persist();
        return result;
      },

      setPartial(partial: string) {
        set({ partial });
        recompute();
        scheduleRefine();
      },

      accept(command: string) {
        if (get().settings.pauseLearning) return;
        engine.feedback(command, true);
        void persist();
      },

      reject(command: string) {
        if (get().settings.pauseLearning) return;
        engine.feedback(command, false);
        recompute();
        void persist();
      },

      async reset() {
        engine.reset();
        await repo.clear();
        set({ history: [], partial: "", suggestions: [] });
        refreshGraph();
        recompute();
      },

      setSetting(key, value) {
        const settings = { ...get().settings, [key]: value };
        set({ settings });
        void repo.saveSettings(settings);
      },

      setStatus(status) {
        set((s) => ({ status: { ...s.status, ...status } }));
      },

      exportModel() {
        return toBlob({ model: engine.serialize(), settings: get().settings, updatedAt: now() });
      },

      async importModel(blob: string) {
        const state = fromBlob(blob);
        engine.load(state.model);
        set({ settings: state.settings, history: engine.getHistory() });
        await persist();
        await repo.saveSettings(state.settings);
        refreshGraph();
        recompute();
      },
    };
  });
}
