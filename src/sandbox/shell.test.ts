import { describe, it, expect } from "vitest";
import { Shell } from "./shell";
import { SEED_SCENARIOS } from "./seeds";

describe("Shell", () => {
  it("git status on the seeded dirty tree lists changes", () => {
    const sh = new Shell();
    const res = sh.run("git status");
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("On branch main");
    expect(res.output).toContain("src/index.ts");
    expect(res.output).toContain("README.md");
  });

  it("git add then commit returns a stable hash, reproducible across shells", () => {
    const run = () => {
      const sh = new Shell();
      sh.run("git add .");
      return sh.run('git commit -m "x"');
    };
    const a = run();
    const b = run();

    const hashA = a.output.match(/\[main ([0-9a-f]{7})\]/);
    const hashB = b.output.match(/\[main ([0-9a-f]{7})\]/);
    expect(hashA).not.toBeNull();
    expect(hashB).not.toBeNull();
    expect(hashA?.[1]).toBe(hashB?.[1]);
    expect(a.output).toContain("x");
  });

  it("npm run dev output mentions localhost:3000", () => {
    const sh = new Shell();
    const res = sh.run("npm run dev");
    expect(res.output).toContain("localhost:3000");
  });

  it("unknown command returns exit code 127 and a not-found message", () => {
    const sh = new Shell();
    const res = sh.run("frobnicate --now");
    expect(res.exitCode).toBe(127);
    expect(res.output).toContain("command not found");
  });

  it("cd src then pwd reflects the vfs cwd", () => {
    const sh = new Shell();
    sh.run("cd src");
    const res = sh.run("pwd");
    expect(res.output).toBe("/home/dev/project/src");
  });

  it("git checkout -b updates the prompt branch", () => {
    const sh = new Shell();
    sh.run("git checkout -b feature/x");
    expect(sh.prompt).toContain("(feature/x)");
  });

  it("prompt collapses the home prefix to ~", () => {
    const sh = new Shell();
    expect(sh.prompt).toContain("~/project");
    expect(sh.prompt).toContain("(main)");
  });

  it("git add stages, so a follow-up status shows nothing unstaged", () => {
    const sh = new Shell();
    sh.run("git add .");
    const res = sh.run("git status");
    expect(res.output).toContain("Changes to be committed");
    expect(res.output).not.toContain("not staged");
  });

  it("grep finds TODO markers in the seeded source", () => {
    const sh = new Shell();
    const res = sh.run("grep -r TODO src");
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("TODO");
  });

  it("SEED_SCENARIOS git-loop has length 4", () => {
    expect(SEED_SCENARIOS["git-loop"]).toHaveLength(4);
  });
});
