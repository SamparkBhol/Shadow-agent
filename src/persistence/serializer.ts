import type { PersistedState } from "./schema";

// Tag and version for the export wrapper so we can reject foreign or
// incompatible blobs early instead of failing somewhere downstream.
const FORMAT = "shadow-agent";
const FORMAT_VERSION = 1;

interface Wrapper {
  format: string;
  version: number;
  state: PersistedState;
}

export function toBlob(state: PersistedState): string {
  const wrapper: Wrapper = {
    format: FORMAT,
    version: FORMAT_VERSION,
    state,
  };
  return JSON.stringify(wrapper);
}

export function fromBlob(text: string): PersistedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse blob: invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Could not parse blob: expected an object");
  }

  const wrapper = parsed as Partial<Wrapper>;

  if (wrapper.format !== FORMAT) {
    throw new Error(
      `Unrecognized blob format: expected "${FORMAT}", got ${JSON.stringify(wrapper.format)}`,
    );
  }

  if (wrapper.version !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported blob version: expected ${FORMAT_VERSION}, got ${JSON.stringify(wrapper.version)}`,
    );
  }

  if (typeof wrapper.state !== "object" || wrapper.state === null) {
    throw new Error("Malformed blob: missing state");
  }

  return wrapper.state;
}
