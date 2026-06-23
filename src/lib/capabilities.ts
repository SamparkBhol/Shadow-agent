/** Runtime feature detection used to pick the best embedding backend. */
export async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown> };
    };
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}
