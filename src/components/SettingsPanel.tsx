"use client";

import { selectSettings } from "@/state/selectors";
import { useApp, useAppStore } from "@/state/provider";

type ToggleKey = "pauseLearning" | "reduceMotion";

interface SettingsViewProps {
  settings: { pauseLearning: boolean; reduceMotion: boolean; onboarded: boolean };
  onToggle: (key: ToggleKey, value: boolean) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

interface SwitchRowProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

// An accessible on/off control built from a real checkbox so it keeps native
// keyboard and screen-reader behaviour. The track and knob are styled on top.
function SwitchRow({ id, label, hint, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex flex-col">
        <span className="font-sans text-sm text-bone">{label}</span>
        <span className="font-sans text-xs text-ash">{hint}</span>
      </label>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-trace-deep focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        />
        <span
          aria-hidden
          className={[
            "pointer-events-none h-5 w-9 rounded-full border transition-colors",
            checked ? "border-trace-deep bg-trace-deep/40" : "border-graphite bg-carbon",
          ].join(" ")}
        />
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute top-0.5 h-4 w-4 rounded-full transition-all",
            checked ? "left-[1.125rem] bg-trace" : "left-0.5 bg-ash",
          ].join(" ")}
        />
      </span>
    </div>
  );
}

/**
 * Presentational settings surface. Holds no state of its own: every control
 * routes back through the props, which keeps it straightforward to test and
 * lets the connected wrapper own the side effects.
 */
export function SettingsView({
  settings,
  onToggle,
  onReset,
  onExport,
  onImport,
}: SettingsViewProps) {
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    // Reset so picking the same file twice still fires a change event.
    e.target.value = "";
  }

  return (
    <section aria-label="Settings" className="flex flex-col gap-4 text-bone">
      <div className="flex flex-col">
        <SwitchRow
          id="setting-pause-learning"
          label="Pause learning"
          hint="Stop recording commands into the model"
          checked={settings.pauseLearning}
          onChange={(v) => onToggle("pauseLearning", v)}
        />
        <div className="h-px bg-graphite" aria-hidden />
        <SwitchRow
          id="setting-reduce-motion"
          label="Reduce motion"
          hint="Trim animations and transitions"
          checked={settings.reduceMotion}
          onChange={(v) => onToggle("reduceMotion", v)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-sm border border-graphite bg-carbon px-3 py-1.5 font-sans text-sm text-bone outline-none transition-colors hover:border-ash focus-visible:ring-2 focus-visible:ring-trace-deep focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          Export model
        </button>

        <label className="rounded-sm border border-graphite bg-carbon px-3 py-1.5 font-sans text-sm text-bone outline-none transition-colors hover:border-ash focus-within:ring-2 focus-within:ring-trace-deep focus-within:ring-offset-2 focus-within:ring-offset-void">
          <span className="cursor-pointer">Import model</span>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="sr-only"
            aria-label="Import model"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-graphite pt-4">
        <button
          type="button"
          onClick={onReset}
          className="self-start rounded-sm border border-fault/40 bg-transparent px-3 py-1.5 font-sans text-sm text-fault outline-none transition-colors hover:border-fault hover:bg-fault/10 focus-visible:ring-2 focus-visible:ring-fault focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          Reset model
        </button>
        <p className="font-mono text-xs text-ash">
          Everything is stored on this device. Nothing is uploaded.
        </p>
      </div>
    </section>
  );
}

/**
 * Connected settings panel. Reads the live settings from the store and wires the
 * controls to its actions. Export builds a JSON blob and triggers a browser
 * download; import reads the chosen file and hands its text to the store.
 */
export function SettingsPanel() {
  const settings = useApp(selectSettings);
  const store = useAppStore();

  function handleExport() {
    if (typeof document === "undefined") return;
    const text = store.getState().exportModel();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shadow-agent-model.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const text = await file.text();
    await store.getState().importModel(text);
  }

  return (
    <SettingsView
      settings={settings}
      onToggle={(key, value) => store.getState().setSetting(key, value)}
      onReset={() => void store.getState().reset()}
      onExport={handleExport}
      onImport={(file) => void handleImport(file)}
    />
  );
}
