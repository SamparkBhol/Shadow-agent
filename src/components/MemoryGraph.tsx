"use client";

import { useEffect, useRef } from "react";
import type { GraphSnapshot, GraphNode } from "@/engine/types";
import { useApp } from "@/state/provider";
import { selectGraph, selectSettings } from "@/state/selectors";

const VOID = "#0A0B0D";
const GRAPHITE = "#1F2226";
const ASH = "#6B7280";
const BONE = "#E6E8EB";
const TRACE = "#3DD8C0";

// Layout tuning. These are deliberately conservative so the simulation settles
// in a handful of passes without ever feeling like it's chasing its tail.
const ITERATIONS = 120;
const REPULSION = 9000;
const SPRING = 0.02;
const SPRING_LENGTH = 90;
const CENTER_PULL = 0.012;
const DAMPING = 0.85;

interface Placed {
  node: GraphNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface GraphCanvasProps {
  graph: GraphSnapshot;
  reduceMotion?: boolean;
}

// FNV-1a over the id, used to seed a stable starting position per node. The
// point is determinism: the same id always lands in the same spot, so the
// layout doesn't reshuffle on every render.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function radiusFor(freq: number): number {
  // Sub-linear growth so a very hot command doesn't swamp the canvas.
  return 4 + Math.sqrt(Math.max(freq, 1)) * 3;
}

function truncate(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

// Build the initial placement. Positions are seeded from the id hash and
// spread over a circle sized to the node count, which keeps things from
// starting on top of each other.
function seed(nodes: GraphNode[], width: number, height: number): Placed[] {
  const cx = width / 2;
  const cy = height / 2;
  const spread = Math.min(width, height) * 0.4;
  return nodes.map((node) => {
    const h = hash(node.id);
    const angle = (h % 360) * (Math.PI / 180);
    const dist = ((h >>> 9) % 1000) / 1000;
    return {
      node,
      x: cx + Math.cos(angle) * spread * dist,
      y: cy + Math.sin(angle) * spread * dist,
      vx: 0,
      vy: 0,
      r: radiusFor(node.freq),
    };
  });
}

// A few passes of repulsion between every pair plus spring forces along edges,
// nudged toward the center so disconnected nodes don't drift off-screen. This
// is intentionally simple and capped; it is not a general-purpose solver.
function relax(placed: Placed[], graph: GraphSnapshot, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const index = new Map<string, Placed>();
  for (const p of placed) index.set(p.node.id, p);

  const maxWeight = graph.edges.reduce((m, e) => Math.max(m, e.weight), 1);

  for (let step = 0; step < ITERATIONS; step++) {
    // Pairwise repulsion.
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]!;
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Coincident: shove apart deterministically using their ids.
          dx = (hash(a.node.id) % 2 === 0 ? 1 : -1) * 0.5;
          dy = (hash(b.node.id) % 2 === 0 ? 1 : -1) * 0.5;
          d2 = dx * dx + dy * dy;
        }
        const force = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Edge springs, stiffer for heavier transitions.
    for (const edge of graph.edges) {
      const a = index.get(edge.from);
      const b = index.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const stiffness = SPRING * (0.5 + edge.weight / maxWeight);
      const force = (d - SPRING_LENGTH) * stiffness;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Gentle pull to center + integrate with damping.
    for (const p of placed) {
      p.vx += (cx - p.x) * CENTER_PULL;
      p.vy += (cy - p.y) * CENTER_PULL;
      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x += p.vx;
      p.y += p.vy;
      // Keep nodes inside the frame so labels stay readable.
      const m = p.r + 4;
      p.x = Math.max(m, Math.min(width - m, p.x));
      p.y = Math.max(m, Math.min(height - m, p.y));
    }
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  placed: Placed[],
  graph: GraphSnapshot,
  width: number,
  height: number,
  font: string,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  if (placed.length === 0) return;

  const index = new Map<string, Placed>();
  for (const p of placed) index.set(p.node.id, p);

  const maxWeight = graph.edges.reduce((m, e) => Math.max(m, e.weight), 1);

  // Edges first, behind the nodes.
  for (const edge of graph.edges) {
    const a = index.get(edge.from);
    const b = index.get(edge.to);
    if (!a || !b) continue;
    const t = edge.weight / maxWeight;
    ctx.strokeStyle = t > 0.5 ? ASH : GRAPHITE;
    ctx.globalAlpha = 0.25 + t * 0.5;
    ctx.lineWidth = 0.75 + t * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Nodes.
  ctx.font = font;
  ctx.textBaseline = "middle";
  for (const p of placed) {
    ctx.fillStyle = TRACE;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // Only label the larger (more frequent) nodes to avoid clutter.
    if (p.r >= 7) {
      ctx.fillStyle = p.r >= 10 ? BONE : ASH;
      ctx.fillText(truncate(p.node.command), p.x + p.r + 4, p.y);
    }
  }
}

/**
 * Presentational canvas for the memory graph. Owns its own layout and draw
 * loop; takes a snapshot and a motion preference and renders the rest.
 */
export function GraphCanvas({ graph }: GraphCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    // jsdom (and any context-less environment) has no 2d context: depending on
    // the build it either returns null or throws. Bail out cleanly either way
    // so tests and SSR fallbacks don't break.
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;

    let placed: Placed[] = [];
    let cssWidth = 0;
    let cssHeight = 0;
    const fontSize = 11;
    const font = `${fontSize}px var(--font-mono), monospace`;

    const layout = () => {
      placed = seed(graph.nodes, cssWidth, cssHeight);
      if (placed.length > 0) relax(placed, graph, cssWidth, cssHeight);
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      cssWidth = Math.max(1, Math.round(rect.width));
      cssHeight = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      // Draw in CSS pixels; the transform handles the device scaling.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      // The layout settles fully in one pass, so a single paint per layout is
      // all that's needed — no perpetual animation loop burning CPU/battery,
      // which also means there is no motion to gate on a reduced-motion setting.
      paint(ctx, placed, graph, cssWidth, cssHeight, font);
    };

    resize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(() => resize());
      ro.observe(host);
    }

    return () => {
      ro?.disconnect();
    };
  }, [graph]);

  return (
    <div ref={hostRef} className="h-full w-full bg-void" role="img" aria-label="Command memory graph">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

/** Connected wrapper: pulls the live graph and motion preference from state. */
export function MemoryGraph() {
  const graph = useApp(selectGraph);
  const settings = useApp(selectSettings);
  return <GraphCanvas graph={graph} reduceMotion={settings.reduceMotion} />;
}
