"use client";

import { useEffect, useRef } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useAppStore } from "@/state/provider";

const THEME = {
  background: "#0A0B0D",
  foreground: "#E6E8EB",
  cursor: "#3DD8C0",
  cursorAccent: "#0A0B0D",
  selectionBackground: "rgba(61,216,192,0.25)",
  black: "#0A0B0D",
  brightBlack: "#6B7280",
  white: "#E6E8EB",
  brightWhite: "#FFFFFF",
  green: "#3DD8C0",
  brightGreen: "#16A394",
  yellow: "#E0A458",
  red: "#E5484D",
  cyan: "#3DD8C0",
};

const DIM = "\x1b[38;2;107;114;128m"; // Ash, for ghost text
const RESET = "\x1b[0m";

function monoFamily(): string {
  if (typeof document === "undefined") return "monospace";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return v ? `${v}, monospace` : "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace";
}

export function TerminalView() {
  const store = useAppStore();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    const input = { value: "" };
    const ghost = { value: "" };
    let busy = false;
    let term: XTerm | null = null;
    let cleanupResize: (() => void) | null = null;
    let unsub: (() => void) | null = null;

    const promptText = () => `${store.getState().prompt} `;

    const draw = () => {
      if (!term) return;
      term.write("\r\x1b[2K"); // carriage return + clear line
      term.write(promptText() + input.value);
      if (ghost.value) {
        term.write(DIM + ghost.value + RESET);
        const back = [...ghost.value].length; // count code points, not UTF-16 units
        if (back > 0) term.write(`\x1b[${back}D`); // move cursor back before the ghost
      }
    };

    const syncGhost = () => {
      const top = store.getState().suggestions[0]?.command;
      const cur = input.value;
      let g = "";
      if (top && top !== cur) {
        g = cur.length === 0 ? top : top.startsWith(cur) ? top.slice(cur.length) : "";
      }
      // Never let a suggestion (e.g. from an imported model) inject control
      // sequences into the terminal.
      ghost.value = g.replace(/[\u0000-\u001f\u007f]/g, "");
    };

    const newPrompt = () => {
      input.value = "";
      store.getState().setPartial("");
      syncGhost();
      draw();
    };

    const printableOf = (text: string) => [...text].filter((ch) => ch >= " ").join("");

    const submit = async (line: string) => {
      if (!term) return;
      ghost.value = "";
      input.value = "";
      term.write("\r\n");
      busy = true;
      const result = await store.getState().runCommand(line);
      if (result.output) term.write(result.output.replace(/\n/g, "\r\n") + "\r\n");
      busy = false;
      newPrompt();
    };

    const onData = async (data: string) => {
      if (busy || !term) return;

      // Tab — accept the ghost completion
      if (data === "\t") {
        if (ghost.value) {
          input.value += ghost.value;
          store.getState().accept(input.value);
          store.getState().setPartial(input.value);
          syncGhost();
          draw();
        }
        return;
      }

      // Backspace / Delete
      if (data === "\x7f") {
        if (input.value.length > 0) {
          input.value = input.value.slice(0, -1);
          store.getState().setPartial(input.value);
          syncGhost();
          draw();
        }
        return;
      }

      // Ctrl+C — cancel the current line
      if (data === "\x03") {
        term.write("^C\r\n");
        newPrompt();
        return;
      }

      // Ctrl+L — clear the screen
      if (data === "\x0c") {
        term.clear();
        newPrompt();
        return;
      }

      // Ignore escape sequences (arrow keys, etc.).
      if (data.charCodeAt(0) === 0x1b) return;

      // Enter, or a multi-line paste: run each completed line, and keep whatever
      // follows the final newline as the in-progress input.
      if (/[\r\n]/.test(data)) {
        const segments = data.split(/\r\n|\r|\n/);
        for (let i = 0; i < segments.length; i++) {
          input.value += printableOf(segments[i] ?? "");
          if (i < segments.length - 1) await submit(input.value);
        }
        store.getState().setPartial(input.value);
        syncGhost();
        draw();
        return;
      }

      // Plain printable input (including a single-line paste).
      const printable = printableOf(data);
      if (!printable) return;
      input.value += printable;
      store.getState().setPartial(input.value);
      syncGhost();
      draw();
    };

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);
      if (disposed || !hostRef.current) return;

      const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
      if (disposed || !hostRef.current) return;

      term = new Terminal({
        fontFamily: monoFamily(),
        fontSize: 13,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: "block",
        theme: THEME,
        convertEol: false,
        scrollback: 2000,
        allowProposedApi: true,
        // Mirror output into an off-screen live region for assistive tech.
        screenReaderMode: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(hostRef.current);
      fit.fit();

      term.writeln("Shadow Agent — a terminal that learns how you work.");
      term.writeln(`${DIM}This is a sandboxed shell. Nothing leaves your browser.${RESET}`);
      term.writeln("");
      newPrompt();
      term.focus();

      term.onData(onData);

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          // container not laid out yet
        }
      });
      ro.observe(hostRef.current);
      cleanupResize = () => ro.disconnect();

      // Redraw the input line when suggestions change (e.g. async refine lands),
      // unless we're mid-command writing output.
      unsub = store.subscribe(() => {
        if (busy) return;
        syncGhost();
        draw();
      });
    })();

    return () => {
      disposed = true;
      unsub?.();
      cleanupResize?.();
      term?.dispose();
    };
  }, [store]);

  return <div ref={hostRef} className="h-full w-full" aria-label="Shadow Agent terminal" role="group" />;
}
