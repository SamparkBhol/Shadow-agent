"use client";

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Suggestion } from "@/engine/types";
import { SuggestionList } from "./SuggestionBar";

const SAMPLE: Suggestion[] = [
  { command: "git push", confidence: 0.82, source: "fused", reason: "seen often after commit" },
  { command: "git status", confidence: 0.61, source: "sequence", reason: "common follow-up" },
  { command: "rm -rf node_modules", confidence: 0.4, source: "semantic", reason: "cleanup", risky: true },
];

function setup(props: Partial<React.ComponentProps<typeof SuggestionList>> = {}) {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  render(
    <SuggestionList
      suggestions={props.suggestions ?? SAMPLE}
      onAccept={props.onAccept ?? onAccept}
      onReject={props.onReject ?? onReject}
    />,
  );
  return { onAccept, onReject };
}

describe("SuggestionList", () => {
  it("renders one option per suggestion inside a listbox", () => {
    setup();
    expect(screen.getByRole("listbox", { name: "Command suggestions" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(SAMPLE.length);
  });

  it("gives each option an accessible name with the command and a confidence percentage", () => {
    setup();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAccessibleName(/git push/);
    expect(options[0]).toHaveAccessibleName(/82%/);
    expect(options[1]).toHaveAccessibleName(/git status/);
    expect(options[1]).toHaveAccessibleName(/61%/);
  });

  it("accepts the active option when Enter is pressed on the focused listbox", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{Enter}");
    expect(onAccept).toHaveBeenCalledWith("git push");
  });

  it("moves with ArrowDown and accepts the second suggestion", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onAccept).toHaveBeenCalledWith("git status");
  });

  it("accepts a suggestion when it is clicked", async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    await user.click(screen.getByText("git status"));
    expect(onAccept).toHaveBeenCalledWith("git status");
  });

  it("shows a caution marker for a risky suggestion", () => {
    setup();
    expect(screen.getByText("caution")).toBeInTheDocument();
  });

  it("rejects the active option with Backspace", async () => {
    const user = userEvent.setup();
    const { onReject } = setup();
    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{Backspace}");
    expect(onReject).toHaveBeenCalledWith("git push");
  });

  it("renders a placeholder when there are no suggestions", () => {
    setup({ suggestions: [] });
    expect(screen.getByText("no suggestions yet")).toBeInTheDocument();
  });
});
