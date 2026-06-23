/**
 * A tiny in-memory POSIX-ish filesystem. Paths are normalized to absolute
 * form and stored in a flat Map, which keeps lookups simple and lets the
 * shell simulator query the tree without any real disk access.
 */

type NodeType = "dir" | "file";

interface FsNode {
  type: NodeType;
  content?: string;
}

const HOME = "/home/dev";

export class Vfs {
  cwd: string;
  private nodes: Map<string, FsNode>;

  constructor() {
    this.nodes = new Map();
    // Every tree starts with a root and a home directory so that `~`
    // expansion and absolute paths always have somewhere to land.
    this.nodes.set("/", { type: "dir" });
    this.mkdir(HOME);
    this.cwd = HOME;
  }

  mkdir(path: string): void {
    const abs = this.resolve(path);
    // Create every missing parent along the way, like `mkdir -p`.
    const parts = abs.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += "/" + part;
      if (!this.nodes.has(current)) {
        this.nodes.set(current, { type: "dir" });
      }
    }
  }

  writeFile(path: string, content: string): void {
    const abs = this.resolve(path);
    const parent = this.parentOf(abs);
    if (parent && !this.nodes.has(parent)) {
      this.mkdir(parent);
    }
    this.nodes.set(abs, { type: "file", content });
  }

  readFile(path: string): string | null {
    const node = this.nodes.get(this.resolve(path));
    if (!node || node.type !== "file") return null;
    return node.content ?? "";
  }

  exists(path: string): boolean {
    return this.nodes.has(this.resolve(path));
  }

  /** List the entries directly inside a directory, sorted by name. */
  ls(path?: string): string[] {
    const abs = path === undefined ? this.cwd : this.resolve(path);
    const node = this.nodes.get(abs);
    if (!node || node.type !== "dir") return [];

    const prefix = abs === "/" ? "/" : abs + "/";
    const names = new Set<string>();
    for (const key of this.nodes.keys()) {
      if (key === abs || !key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const name = rest.split("/")[0];
      if (name) names.add(name);
    }
    return [...names].sort();
  }

  /** Change directory. Returns false if the target is missing or a file. */
  cd(path: string): boolean {
    const abs = this.resolve(path);
    const node = this.nodes.get(abs);
    if (!node || node.type !== "dir") return false;
    this.cwd = abs;
    return true;
  }

  /** Turn any user-supplied path into a normalized absolute path. */
  resolve(path: string): string {
    let p = path;
    if (p === "~" || p === "~/") {
      p = HOME;
    } else if (p.startsWith("~/")) {
      p = HOME + "/" + p.slice(2);
    }

    const base = p.startsWith("/") ? p : this.cwd + "/" + p;
    const parts = base.split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        stack.pop();
        continue;
      }
      stack.push(part);
    }
    return "/" + stack.join("/");
  }

  private parentOf(abs: string): string | null {
    if (abs === "/") return null;
    const idx = abs.lastIndexOf("/");
    return idx <= 0 ? "/" : abs.slice(0, idx);
  }
}
