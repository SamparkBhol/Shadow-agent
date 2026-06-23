"use client";

import { useState } from "react";
import { TerminalView } from "./TerminalView";
import { SuggestionBar } from "./SuggestionBar";
import { MemoryGraph } from "./MemoryGraph";
import { StatusDock } from "./StatusDock";
import { SettingsPanel } from "./SettingsPanel";
import { SyncBadge } from "./SyncBadge";
import { Onboarding } from "./Onboarding";
import { useAppStore } from "@/state/provider";

export function Workbench() {
  const store = useAppStore();
  // The provider hydrates settings before rendering us, so this is accurate on
  // the first render — the onboarding card and terminal mount together.
  const [showOnboarding, setShowOnboarding] = useState(
    () => !store.getState().settings.onboarded,
  );

  const dismiss = () => {
    store.getState().setSetting("onboarded", true);
    setShowOnboarding(false);
  };

  return (
    <div className="flex h-dvh flex-col bg-void text-bone">
      <header className="flex items-center justify-between border-b border-graphite px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="inline-block h-4 w-2 animate-cursor-pulse bg-trace" aria-hidden />
          <span className="font-display text-lg tracking-tight">Shadow Agent</span>
          <span className="hidden font-mono text-xs text-ash sm:inline">it learns your hands</span>
        </div>
        <SyncBadge />
      </header>

      <main className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-graphite lg:grid-cols-[1fr_360px]">
        <section className="min-h-0 bg-void p-3">
          <div className="h-full overflow-hidden rounded-md border border-graphite bg-void">
            <TerminalView />
          </div>
        </section>
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-void p-3">
          <StatusDock />
          <SuggestionBar />
          <div className="h-52 overflow-hidden rounded-md border border-graphite">
            <MemoryGraph />
          </div>
          <SettingsPanel />
        </aside>
      </main>

      <Onboarding visible={showOnboarding} onStart={dismiss} onSkip={dismiss} />
    </div>
  );
}
