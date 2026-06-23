"use client";

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GraphCanvas } from "./MemoryGraph";
import type { GraphSnapshot } from "@/engine/types";

describe("GraphCanvas", () => {
  it("renders a canvas for a single-node graph without throwing", () => {
    const graph: GraphSnapshot = {
      nodes: [{ id: "git add", command: "git add", freq: 2, lastSeen: 0 }],
      edges: [],
    };
    const { container } = render(<GraphCanvas graph={graph} reduceMotion />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("renders an empty graph without throwing", () => {
    const graph: GraphSnapshot = { nodes: [], edges: [] };
    const { container } = render(<GraphCanvas graph={graph} reduceMotion />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });
});
