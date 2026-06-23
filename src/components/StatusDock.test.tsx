import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusView } from "./StatusDock";

const baseStats = {
  commands: 42,
  patterns: 7,
  topConfidence: 0.81,
  maturity: 0.5,
};

describe("StatusView", () => {
  it("shows the commands and patterns counts", () => {
    render(
      <StatusView
        stats={baseStats}
        status={{ backend: "webgpu", modelLoading: false }}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("labels a webgpu backend as running on the GPU", () => {
    render(
      <StatusView
        stats={baseStats}
        status={{ backend: "webgpu", modelLoading: false }}
      />,
    );
    expect(screen.getByText(/GPU/)).toBeInTheDocument();
  });

  it("shows 'warming up' while the model is loading", () => {
    render(
      <StatusView
        stats={baseStats}
        status={{ backend: "webgpu", modelLoading: true }}
      />,
    );
    expect(screen.getByText("warming up")).toBeInTheDocument();
  });

  it("shows 'sequence only' when no backend is available", () => {
    render(
      <StatusView
        stats={baseStats}
        status={{ backend: "unavailable", modelLoading: false }}
      />,
    );
    expect(screen.getByText("sequence only")).toBeInTheDocument();
  });

  it("gives the maturity meter an aria-label", () => {
    render(
      <StatusView
        stats={baseStats}
        status={{ backend: "wasm", modelLoading: false }}
      />,
    );
    expect(screen.getByLabelText(/Model maturity/)).toBeInTheDocument();
  });
});
