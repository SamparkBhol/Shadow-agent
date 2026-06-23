import { describe, it, expect } from "vitest";
import { getSyncProvider } from "./flags";
import { NoOpSync } from "./noop";

describe("getSyncProvider", () => {
  it("returns a disabled provider when sync is off", async () => {
    const provider = await getSyncProvider();
    expect(provider.isEnabled()).toBe(false);
  });
});

describe("NoOpSync", () => {
  it("push resolves without doing anything", async () => {
    await expect(new NoOpSync().push("x")).resolves.toBeUndefined();
  });

  it("pull resolves to null", async () => {
    await expect(new NoOpSync().pull()).resolves.toBeNull();
  });
});
