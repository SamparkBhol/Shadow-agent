"use client";

import { flags } from "@/lib/config";

/**
 * Tiny badge reflecting whether remote sync is wired up. With no sync endpoint
 * configured the agent is purely local; the badge says so.
 */
export function SyncBadge() {
  if (flags.syncEnabled) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wide text-ash">Sync on</span>
    );
  }

  return (
    <span className="font-mono text-[10px] uppercase tracking-wide text-ash">
      <span aria-hidden>•</span> Local only
    </span>
  );
}
