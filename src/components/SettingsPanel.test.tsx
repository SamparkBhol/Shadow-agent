"use client";

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "./SettingsPanel";

function setup(props: Partial<React.ComponentProps<typeof SettingsView>> = {}) {
  const onToggle = vi.fn();
  const onReset = vi.fn();
  const onExport = vi.fn();
  const onImport = vi.fn();
  render(
    <SettingsView
      settings={props.settings ?? { pauseLearning: false, reduceMotion: false, onboarded: true }}
      onToggle={props.onToggle ?? onToggle}
      onReset={props.onReset ?? onReset}
      onExport={props.onExport ?? onExport}
      onImport={props.onImport ?? onImport}
    />,
  );
  return { onToggle, onReset, onExport, onImport };
}

describe("SettingsView", () => {
  it("toggling the Pause learning switch calls onToggle with the new value", async () => {
    const user = userEvent.setup();
    const { onToggle } = setup();
    await user.click(screen.getByRole("switch", { name: /pause learning/i }));
    expect(onToggle).toHaveBeenCalledWith("pauseLearning", true);
  });

  it("clicking Reset model calls onReset", async () => {
    const user = userEvent.setup();
    const { onReset } = setup();
    await user.click(screen.getByRole("button", { name: /reset model/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("clicking Export model calls onExport", async () => {
    const user = userEvent.setup();
    const { onExport } = setup();
    await user.click(screen.getByRole("button", { name: /export model/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("shows the privacy line", () => {
    setup();
    expect(
      screen.getByText("Everything is stored on this device. Nothing is uploaded."),
    ).toBeInTheDocument();
  });
});
