import { describe, it, expect } from "vitest";
import { fuse, isRisky } from "./ranker";
import type { Suggestion } from "./types";

const seq = (command: string, confidence: number): Suggestion => ({
  command,
  confidence,
  source: "sequence",
  reason: "",
});
const sem = (command: string, confidence: number): Suggestion => ({
  command,
  confidence,
  source: "semantic",
  reason: "",
});

describe("ranker", () => {
  it("flags destructive commands", () => {
    expect(isRisky("rm -rf /")).toBe(true);
    expect(isRisky("git push --force")).toBe(true);
    expect(isRisky("ls -la")).toBe(false);
  });

  it("marks commands found in both lists as fused", () => {
    const out = fuse([seq("git push", 0.8)], [sem("git push", 0.7)], 0.9, 3);
    expect(out[0]!.command).toBe("git push");
    expect(out[0]!.source).toBe("fused");
  });

  it("never ranks a risky command first", () => {
    const out = fuse([seq("rm -rf build", 0.95), seq("npm run build", 0.4)], [], 0.9, 2);
    expect(out[0]!.command).toBe("npm run build");
    expect(out.find((s) => s.command === "rm -rf build")?.risky).toBe(true);
  });

  it("weights semantic higher when maturity is low", () => {
    const out = fuse([seq("a", 0.9)], [sem("b", 0.9)], 0, 2);
    expect(out[0]!.command).toBe("b");
  });
});
