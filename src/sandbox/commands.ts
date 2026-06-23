/**
 * Parsing helpers shared by the shell simulator. Kept separate so the parsing
 * rules can be tested and reused without pulling in the simulator state.
 */

/**
 * Split a command line into argv, honoring single and double quotes. Quotes
 * group whitespace into a single token and are stripped from the result.
 */
export function parseLine(line: string): { argv: string[] } {
  const argv: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let started = false;

  for (const ch of line) {
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        current += ch;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      started = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      started = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (started) {
        argv.push(current);
        current = "";
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }
  if (started) argv.push(current);

  return { argv };
}

/** Render an integer as a git-style 7-character short hash, deterministically. */
export function shortHash(seed: number): string {
  // A small mix so consecutive seeds don't look sequential, then map the
  // 28 low bits onto hex digits to get a stable seven-char identifier.
  let x = (seed * 2654435761) >>> 0;
  x ^= x >>> 15;
  const hex = (x >>> 4).toString(16).padStart(7, "0");
  return hex.slice(0, 7);
}
