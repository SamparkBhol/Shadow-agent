import { describe, it, expect, vi } from "vitest";
import { createAppStore } from "./store";
import { Engine } from "@/engine";
import { Shell } from "@/sandbox/shell";
import { Repository } from "@/persistence/repository";

async function makeStore() {
  const engine = new Engine(); // markov-only is enough for these tests
  const shell = new Shell();
  const repo = await Repository.open();
  await repo.clear();
  const store = createAppStore({ engine, shell, repo, now: () => 0, refineDelay: 5 });
  return { engine, shell, repo, store };
}

describe("app store", () => {
  it("runCommand records history, learns, persists, and refreshes stats", async () => {
    const { engine, repo, store } = await makeStore();
    const recordSpy = vi.spyOn(engine, "record");
    const saveSpy = vi.spyOn(repo, "saveModel");

    await store.getState().runCommand("git status");
    await store.getState().runCommand("git add .");

    expect(store.getState().history).toEqual(["git status", "git add ."]);
    expect(recordSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy).toHaveBeenCalled();
    expect(store.getState().stats.commands).toBe(2);
    expect(store.getState().stats.patterns).toBeGreaterThan(0);
  });

  it("does not learn while learning is paused", async () => {
    const { engine, store } = await makeStore();
    const recordSpy = vi.spyOn(engine, "record");
    store.getState().setSetting("pauseLearning", true);
    await store.getState().runCommand("git status");
    expect(recordSpy).not.toHaveBeenCalled();
    expect(store.getState().history).toEqual([]);
  });

  it("setPartial updates suggestions synchronously from the sequence model", async () => {
    const { store } = await makeStore();
    await store.getState().runCommand("git status");
    await store.getState().runCommand("git add .");
    await store.getState().runCommand("git status");

    store.getState().setPartial("git a");
    const sugg = store.getState().suggestions;
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg.every((x) => x.command.startsWith("git a"))).toBe(true);
  });

  it("accept and reject route feedback to the engine", async () => {
    const { engine, store } = await makeStore();
    const fb = vi.spyOn(engine, "feedback");
    store.getState().accept("git push");
    store.getState().reject("git push");
    expect(fb).toHaveBeenCalledWith("git push", true);
    expect(fb).toHaveBeenCalledWith("git push", false);
  });

  it("reset clears history and the stored model", async () => {
    const { repo, store } = await makeStore();
    const clearSpy = vi.spyOn(repo, "clear");
    await store.getState().runCommand("git status");
    await store.getState().reset();
    expect(clearSpy).toHaveBeenCalled();
    expect(store.getState().history).toEqual([]);
    expect(store.getState().stats.commands).toBe(0);
  });

  it("exports a portable model blob", async () => {
    const { store } = await makeStore();
    await store.getState().runCommand("git status");
    const blob = store.getState().exportModel();
    expect(blob).toContain("shadow-agent");
  });
});
