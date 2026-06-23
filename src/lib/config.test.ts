import { describe, it, expect } from "vitest";
import { flags } from "./config";

describe("config flags", () => {
  it("disables sync when NEXT_PUBLIC_SYNC_URL is unset", () => {
    expect(flags.syncEnabled).toBe(false);
  });
});
