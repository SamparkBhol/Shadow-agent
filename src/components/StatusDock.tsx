"use client";

import { selectStats, selectStatus } from "@/state/selectors";
import { useApp } from "@/state/provider";

interface StatusViewProps {
  stats: {
    commands: number;
    patterns: number;
    topConfidence: number;
    maturity: number;
  };
  status: {
    backend: string;
    modelLoading: boolean;
  };
}

function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

// The backend pill describes where inference runs without exposing the raw
// state machine. "warming up" wins over the resolved backend while the model
// is still loading.
function backendLabel(backend: string, modelLoading: boolean): string {
  if (modelLoading || backend === "loading") return "warming up";
  switch (backend) {
    case "webgpu":
      return "on-device · GPU";
    case "wasm":
      return "on-device · WASM";
    case "unavailable":
      return "sequence only";
    default:
      return "sequence only";
  }
}

/**
 * Presentational live stats strip. Holds no state, so it's driven entirely by
 * plain props and is straightforward to test in isolation.
 */
export function StatusView({ stats, status }: StatusViewProps) {
  const maturity = pct(stats.maturity);
  const confidence = pct(stats.topConfidence);
  const pill = backendLabel(status.backend, status.modelLoading);

  return (
    <div className="flex items-center gap-4 rounded-sm border border-graphite bg-carbon px-3 py-1.5 text-xs">
      <span className="flex items-baseline gap-1.5">
        <span className="text-ash">commands</span>
        <span className="font-mono tabular-nums text-bone">{stats.commands}</span>
      </span>

      <span className="flex items-baseline gap-1.5">
        <span className="text-ash">patterns</span>
        <span className="font-mono tabular-nums text-bone">{stats.patterns}</span>
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-ash">model maturity</span>
        <span
          className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-graphite"
          role="meter"
          aria-label={`Model maturity ${maturity}%`}
          aria-valuenow={maturity}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="block h-full bg-trace" style={{ width: `${maturity}%` }} />
        </span>
      </span>

      <span className="flex items-baseline gap-1.5">
        <span className="text-ash">top confidence</span>
        <span
          className="font-mono tabular-nums text-bone"
          aria-label={`Top confidence ${confidence}%`}
        >
          {confidence}%
        </span>
      </span>

      <span className="ml-auto rounded-sm border border-graphite px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-trace">
        {pill}
      </span>
    </div>
  );
}

/**
 * Connected status dock: reads the live stats and backend status from the store
 * and hands them to the presentational view.
 */
export function StatusDock() {
  const stats = useApp(selectStats);
  const status = useApp(selectStatus);
  return <StatusView stats={stats} status={status} />;
}
