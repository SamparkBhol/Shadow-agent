"use client";

import { useEffect, useRef } from "react";

interface OnboardingProps {
  visible: boolean;
  onStart: () => void;
  onSkip: () => void;
}

/**
 * First-run modal that explains what the agent does. Presentational: the parent
 * decides when it shows and what the buttons do. Focus lands on the primary
 * action when it opens, and Escape is treated as a skip.
 */
export function Onboarding({ visible, onStart, onSkip }: OnboardingProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Move focus into the dialog on open and restore it to the previously focused
  // element when the dialog closes.
  useEffect(() => {
    if (!visible) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    startRef.current?.focus();
    return () => restoreRef.current?.focus();
  }, [visible]);

  // Escape skips; Tab/Shift+Tab is trapped between the dialog's two buttons.
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, onSkip]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md rounded-md border border-graphite bg-carbon p-6 shadow-2xl"
      >
        <h2 id="onboarding-title" className="font-display text-lg text-bone">
          Shadow Agent
        </h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ash">
          This is a sandboxed terminal. I learn how you work and predict your next
          command &mdash; all on your device, nothing leaves this browser.
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-sm border border-graphite bg-transparent px-3 py-1.5 font-sans text-sm text-ash outline-none transition-colors hover:border-ash hover:text-bone focus-visible:ring-2 focus-visible:ring-trace-deep focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
          >
            Skip, let me type
          </button>
          <button
            ref={startRef}
            type="button"
            onClick={onStart}
            className="rounded-sm border border-trace-deep bg-trace-deep/20 px-3 py-1.5 font-sans text-sm text-trace outline-none transition-colors hover:bg-trace-deep/30 focus-visible:ring-2 focus-visible:ring-trace-deep focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
          >
            Show me (10s)
          </button>
        </div>
      </div>
    </div>
  );
}
