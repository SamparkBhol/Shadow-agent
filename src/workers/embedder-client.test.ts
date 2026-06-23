import { describe, it, expect } from "vitest";
import { createEmbedder } from "./embedder-client";
import { detectWebGPU } from "@/lib/capabilities";

describe("embedder client (no Worker available)", () => {
  it("falls back to a safe no-op embedder", async () => {
    expect(typeof Worker).toBe("undefined"); // node test env
    const e = createEmbedder();
    expect(await e.embed(["anything"])).toEqual([]);
    expect((await e.ready()).backend).toBe("unavailable");
    e.dispose();
  });
});

describe("capabilities", () => {
  it("reports no WebGPU when navigator is absent", async () => {
    expect(await detectWebGPU()).toBe(false);
  });
});
