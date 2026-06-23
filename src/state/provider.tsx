"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createAppStore, type AppStore, type AppState } from "./store";
import { Engine } from "@/engine";
import { Shell } from "@/sandbox/shell";
import { Repository } from "@/persistence/repository";
import { createEmbedder } from "@/workers/embedder-client";

const StoreContext = createContext<AppStore | null>(null);

/**
 * Builds the runtime dependencies on the client (worker, IndexedDB, simulator),
 * wires them into the store, and hydrates persisted state before rendering the
 * app. Everything here is browser-only by design.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<AppStore | null>(null);

  useEffect(() => {
    let disposed = false;
    const embedder = createEmbedder();

    (async () => {
      const engine = new Engine(embedder);
      const shell = new Shell();
      const repo = await Repository.open();
      const created = createAppStore({ engine, shell, repo });
      await created.getState().hydrate();
      if (disposed) return;
      setStore(created);

      // The embedding model warms up in the background; the app is fully usable
      // (sequence predictions) before it finishes.
      embedder
        .ready()
        .then((r) => {
          if (!disposed) created.getState().setStatus({ backend: r.backend, modelLoading: false });
        })
        .catch(() => {
          if (!disposed) created.getState().setStatus({ backend: "unavailable", modelLoading: false });
        });
    })();

    return () => {
      disposed = true;
      embedder.dispose();
    };
  }, []);

  if (!store) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-void" aria-busy>
        <span className="h-5 w-2.5 animate-cursor-pulse bg-trace" aria-hidden />
        <span className="sr-only">Starting Shadow Agent</span>
      </div>
    );
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Read a slice of app state. Must be used inside StoreProvider. */
export function useApp<T>(selector: (s: AppState) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useApp must be used within StoreProvider");
  return useStore(store, selector);
}

/** Access the store handle (for invoking actions via getState()). */
export function useAppStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used within StoreProvider");
  return store;
}
