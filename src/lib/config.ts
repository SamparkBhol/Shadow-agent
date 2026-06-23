// Single source of truth for env-derived feature flags. Read once.
// NEXT_PUBLIC_* vars are inlined at build time.
export const flags = {
  syncEnabled: Boolean(process.env.NEXT_PUBLIC_SYNC_URL),
} as const;

export const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_URL ?? "";
