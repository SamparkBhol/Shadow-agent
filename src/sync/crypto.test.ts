import { describe, it, expect } from "vitest";
import { encryptState, decryptState } from "./crypto";

describe("sync crypto", () => {
  it("round-trips plaintext with the correct passphrase", async () => {
    const original = "hello model state";
    const blob = await encryptState(original, "pw");
    expect(await decryptState(blob, "pw")).toBe(original);
  });

  it("rejects decryption with the wrong passphrase", async () => {
    const blob = await encryptState("hello model state", "pw");
    await expect(decryptState(blob, "wrong")).rejects.toThrow();
  });

  it("produces different blobs for the same plaintext", async () => {
    const first = await encryptState("hello model state", "pw");
    const second = await encryptState("hello model state", "pw");
    expect(first).not.toBe(second);
    // Both still decrypt back to the original.
    expect(await decryptState(first, "pw")).toBe("hello model state");
    expect(await decryptState(second, "pw")).toBe("hello model state");
  });
});
