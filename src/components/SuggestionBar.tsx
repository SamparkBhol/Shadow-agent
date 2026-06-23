"use client";

import { useEffect, useRef, useState } from "react";
import type { Suggestion, SuggestionSource } from "@/engine/types";
import { selectSuggestions } from "@/state/selectors";
import { useApp, useAppStore } from "@/state/provider";

interface SuggestionListProps {
  suggestions: Suggestion[];
  onAccept: (command: string) => void;
  onReject: (command: string) => void;
}

const SOURCE_TAG: Record<SuggestionSource, string> = {
  sequence: "seq",
  semantic: "sem",
  fused: "both",
};

const SOURCE_PHRASE: Record<SuggestionSource, string> = {
  sequence: "sequence match",
  semantic: "semantic match",
  fused: "sequence and semantic match",
};

function pct(confidence: number): number {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

function optionLabel(s: Suggestion): string {
  const parts = [s.command, `${pct(s.confidence)}% confidence`, SOURCE_PHRASE[s.source]];
  if (s.risky) parts.push("caution: destructive");
  return parts.join(", ");
}

/**
 * Presentational suggestion list. Renders an ARIA listbox the user can drive
 * from the keyboard: arrows move the active option, Enter or Right accepts it,
 * Backspace or "x" rejects it. Holds no app state of its own beyond the active
 * index, so it's trivial to test with plain props.
 */
export function SuggestionList({ suggestions, onAccept, onReject }: SuggestionListProps) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active index in range as suggestions come and go.
  useEffect(() => {
    setActive((i) => Math.min(Math.max(i, 0), Math.max(suggestions.length - 1, 0)));
  }, [suggestions.length]);

  const count = suggestions.length;

  function move(delta: number) {
    if (count === 0) return;
    setActive((i) => Math.min(Math.max(i + delta, 0), count - 1));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (count === 0) return;
    const current = suggestions[Math.min(active, count - 1)];
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Enter":
      case "ArrowRight":
        e.preventDefault();
        if (current) onAccept(current.command);
        break;
      case "Backspace":
      case "Delete":
      case "x":
      case "X":
        e.preventDefault();
        if (current) onReject(current.command);
        break;
      default:
        break;
    }
  }

  const top = suggestions[0]?.command ?? "";

  return (
    <div className="flex flex-col gap-1">
      <span className="sr-only" aria-live="polite">
        {top ? `Top suggestion: ${top}` : "No suggestions"}
      </span>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Command suggestions"
        tabIndex={0}
        aria-activedescendant={count ? `sugg-opt-${Math.min(active, count - 1)}` : undefined}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-px rounded-sm border border-graphite bg-carbon p-1 outline-none focus-visible:border-trace-deep"
      >
        {count === 0 ? (
          <li role="presentation" className="px-2 py-1.5 font-mono text-xs text-ash">
            no suggestions yet
          </li>
        ) : (
          suggestions.map((s, i) => {
            const selected = i === Math.min(active, count - 1);
            return (
              <li
                key={s.command}
                id={`sugg-opt-${i}`}
                role="option"
                aria-selected={selected}
                aria-label={optionLabel(s)}
                onClick={() => {
                  setActive(i);
                  onAccept(s.command);
                }}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-sm",
                  selected ? "bg-graphite" : "hover:bg-graphite/50",
                ].join(" ")}
              >
                <span className="flex-1 truncate font-mono text-bone">{s.command}</span>

                <span
                  className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-graphite"
                  aria-hidden
                >
                  <span
                    className={s.risky ? "block h-full bg-amber" : "block h-full bg-trace"}
                    style={{ width: `${pct(s.confidence)}%` }}
                  />
                </span>

                <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-ash">
                  {pct(s.confidence)}%
                </span>

                <span
                  className="w-9 shrink-0 text-center font-mono text-[10px] uppercase tracking-wide text-trace"
                  aria-hidden
                >
                  {SOURCE_TAG[s.source]}
                </span>

                {s.risky ? (
                  <span
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-amber"
                    aria-hidden
                  >
                    caution
                  </span>
                ) : (
                  <span className="w-0 shrink-0" aria-hidden />
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/**
 * Connected suggestion bar: reads suggestions from the store and routes accept
 * and reject back through the store actions.
 */
export function SuggestionBar() {
  const suggestions = useApp(selectSuggestions);
  const store = useAppStore();
  return (
    <SuggestionList
      suggestions={suggestions}
      onAccept={(c) => store.getState().accept(c)}
      onReject={(c) => store.getState().reject(c)}
    />
  );
}
