import { describe, it, expect } from "vitest";
import { Vfs } from "./vfs";

describe("Vfs", () => {
  it("lists an explicitly built tree at the root", () => {
    const vfs = new Vfs();
    vfs.mkdir("/srv");
    vfs.writeFile("/top.txt", "hi");
    const names = vfs.ls("/");
    expect(names).toContain("srv");
    expect(names).toContain("top.txt");
    expect(names).toContain("home");
    // Sorted output.
    expect([...names]).toEqual([...names].sort());
  });

  it("reads existing files and returns null for missing ones", () => {
    const vfs = new Vfs();
    vfs.writeFile("/home/dev/note.txt", "content here");
    expect(vfs.readFile("/home/dev/note.txt")).toBe("content here");
    expect(vfs.readFile("/home/dev/nope.txt")).toBeNull();
  });

  it("cd into a directory then lists with a relative path", () => {
    const vfs = new Vfs();
    vfs.mkdir("/home/dev/project/src");
    vfs.writeFile("/home/dev/project/src/a.ts", "a");
    vfs.writeFile("/home/dev/project/src/b.ts", "b");

    expect(vfs.cd("/home/dev/project")).toBe(true);
    expect(vfs.ls("src")).toEqual(["a.ts", "b.ts"]);

    expect(vfs.cd("src")).toBe(true);
    expect(vfs.ls()).toEqual(["a.ts", "b.ts"]);
  });

  it("handles cd .. back up the tree", () => {
    const vfs = new Vfs();
    vfs.mkdir("/home/dev/project/src");
    vfs.cd("/home/dev/project/src");
    expect(vfs.cd("..")).toBe(true);
    expect(vfs.cwd).toBe("/home/dev/project");
  });

  it("cd to a nonexistent path returns false and leaves cwd unchanged", () => {
    const vfs = new Vfs();
    const before = vfs.cwd;
    expect(vfs.cd("/no/such/dir")).toBe(false);
    expect(vfs.cwd).toBe(before);
  });

  it("expands ~ to the home directory", () => {
    const vfs = new Vfs();
    vfs.cd("/");
    expect(vfs.cd("~")).toBe(true);
    expect(vfs.cwd).toBe("/home/dev");
  });
});
