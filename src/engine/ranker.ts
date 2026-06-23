import type { Suggestion } from "./types";

/** Patterns we never auto-promote, however statistically likely they are. */
export const DESTRUCTIVE: RegExp[] = [
  /\brm\s+-[a-z]*r[a-z]*f\b/i,
  /\brm\s+-[a-z]*f[a-z]*r\b/i,
  /push\s+--force\b/i,
  /push\s+-f\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bdrop\s+(table|database)\b/i,
  /\bmkfs\b/i,
  /:\s*\(\)\s*\{.*\}/, // fork bomb shape
];

export function isRisky(command: string): boolean {
  return DESTRUCTIVE.some((re) => re.test(command));
}

function softmax(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function normalize(list: Suggestion[]): Map<string, Suggestion & { norm: number }> {
  const probs = softmax(list.map((s) => s.confidence));
  const out = new Map<string, Suggestion & { norm: number }>();
  list.forEach((s, i) => out.set(s.command, { ...s, norm: probs[i] ?? 0 }));
  return out;
}

/**
 * Blend sequence (Markov) and semantic candidates into one ranked list.
 * `maturity` (0..1) shifts trust toward observed sequences as more data
 * accumulates; early on, semantic similarity carries more weight. A risky
 * command is flagged and never allowed to take the top slot.
 */
export function fuse(
  markov: Suggestion[],
  semantic: Suggestion[],
  maturity: number,
  topK: number,
): Suggestion[] {
  const wM = 0.3 + 0.6 * Math.max(0, Math.min(1, maturity));
  const wS = 1 - wM;

  const m = normalize(markov);
  const s = normalize(semantic);
  const commands = new Set<string>([...m.keys(), ...s.keys()]);

  const fused: Suggestion[] = [];
  for (const command of commands) {
    const mi = m.get(command);
    const si = s.get(command);
    const inBoth = Boolean(mi && si);
    let score = (mi ? wM * mi.norm : 0) + (si ? wS * si.norm : 0);
    if (inBoth) score += 0.1; // synergy: both signals agree

    const source: Suggestion["source"] = inBoth ? "fused" : mi ? "sequence" : "semantic";
    const reason = inBoth
      ? `${mi!.reason}; also ${si!.reason}`
      : (mi ?? si)!.reason;

    fused.push({
      command,
      confidence: Math.max(0, Math.min(1, score)),
      source,
      reason,
      risky: isRisky(command),
    });
  }

  fused.sort((a, b) => b.confidence - a.confidence);

  // Never let a destructive command sit at rank 0.
  if (fused[0]?.risky) {
    const firstSafe = fused.findIndex((x) => !x.risky);
    if (firstSafe > 0) {
      const [safe] = fused.splice(firstSafe, 1);
      fused.unshift(safe!);
    }
  }

  return fused.slice(0, topK);
}
