/**
 * A deterministic, sandboxed shell simulator. It does not run anything real:
 * every verb produces believable, reproducible output so the UI can present a
 * live-looking terminal without touching the host. No clocks or randomness are
 * used anywhere; a single internal counter drives any "generated" values.
 */

import { parseLine, shortHash } from "./commands";
import { Vfs } from "./vfs";

const HOME = "/home/dev";

export interface RunResult {
  output: string;
  exitCode: number;
  cwdAfter: string;
  branch: string;
}

interface GitState {
  branch: string;
  branches: Set<string>;
  // Files with working-tree changes that have not been staged yet.
  unstaged: string[];
  // Files moved into the index by `git add`.
  staged: string[];
  // Short hashes of commits made in this session, newest last.
  commits: string[];
}

export class Shell {
  private vfs: Vfs;
  private git: GitState;
  // Drives every "generated" value (commit hashes, etc.) so runs reproduce.
  private counter = 0;

  constructor(vfs?: Vfs) {
    if (vfs) {
      this.vfs = vfs;
      this.git = {
        branch: "main",
        branches: new Set(["main"]),
        unstaged: [],
        staged: [],
        commits: [],
      };
    } else {
      this.vfs = new Vfs();
      this.seedProject();
      this.git = {
        branch: "main",
        branches: new Set(["main"]),
        unstaged: ["src/index.ts", "README.md"],
        staged: [],
        commits: [],
      };
    }
  }

  /** Lay down a small but plausible project under ~/project. */
  private seedProject(): void {
    const root = HOME + "/project";
    this.vfs.mkdir(root);
    this.vfs.mkdir(root + "/src");
    this.vfs.mkdir(root + "/.git");
    this.vfs.writeFile(
      root + "/package.json",
      [
        "{",
        '  "name": "project",',
        '  "version": "0.1.0",',
        '  "private": true,',
        '  "scripts": {',
        '    "dev": "next dev",',
        '    "build": "next build",',
        '    "test": "vitest run"',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    this.vfs.writeFile(
      root + "/README.md",
      ["# project", "", "A small starter app.", "", "// TODO: write real docs", ""].join("\n"),
    );
    this.vfs.writeFile(
      root + "/src/index.ts",
      ["// TODO: implement entrypoint", "export function main() {", '  return "ok";', "}", ""].join("\n"),
    );
    this.vfs.cd(root);
  }

  get prompt(): string {
    return `${this.displayCwd()} (${this.git.branch}) $`;
  }

  /** Collapse the home prefix to `~` the way an interactive shell does. */
  private displayCwd(): string {
    const cwd = this.vfs.cwd;
    if (cwd === HOME) return "~";
    if (cwd.startsWith(HOME + "/")) return "~/" + cwd.slice(HOME.length + 1);
    return cwd;
  }

  run(line: string): RunResult {
    const { argv } = parseLine(line);
    let output = "";
    let exitCode = 0;

    if (argv.length === 0) {
      return this.result("", 0);
    }

    const cmd = argv[0] as string;
    const rest = argv.slice(1);

    switch (cmd) {
      case "git":
        ({ output, exitCode } = this.git_(rest));
        break;
      case "npm":
      case "pnpm":
      case "yarn":
        ({ output, exitCode } = this.pkg(cmd, rest));
        break;
      case "test":
        ({ output, exitCode } = this.runTests());
        break;
      case "docker":
        ({ output, exitCode } = this.docker(rest));
        break;
      case "curl":
        ({ output, exitCode } = this.curl(rest));
        break;
      case "vercel":
        ({ output, exitCode } = this.vercel(rest));
        break;
      case "ls":
        ({ output, exitCode } = this.ls(rest));
        break;
      case "cat":
        ({ output, exitCode } = this.cat(rest));
        break;
      case "cd":
        ({ output, exitCode } = this.cd(rest));
        break;
      case "pwd":
        output = this.vfs.cwd;
        break;
      case "echo":
        output = rest.join(" ");
        break;
      case "grep":
        ({ output, exitCode } = this.grep(rest));
        break;
      case "mkdir":
        ({ output, exitCode } = this.mkdir(rest));
        break;
      case "clear":
        output = "";
        break;
      default:
        output = `bash: ${cmd}: command not found`;
        exitCode = 127;
    }

    return this.result(output, exitCode);
  }

  private result(output: string, exitCode: number): RunResult {
    return {
      output,
      exitCode,
      cwdAfter: this.vfs.cwd,
      branch: this.git.branch,
    };
  }

  // --- git -----------------------------------------------------------------

  private git_(args: string[]): { output: string; exitCode: number } {
    const sub = args[0];
    const g = this.git;

    switch (sub) {
      case "status": {
        const lines = [`On branch ${g.branch}`];
        if (g.staged.length === 0 && g.unstaged.length === 0) {
          lines.push("nothing to commit, working tree clean");
          return { output: lines.join("\n"), exitCode: 0 };
        }
        if (g.staged.length > 0) {
          lines.push("Changes to be committed:");
          for (const f of g.staged) lines.push(`\tmodified:   ${f}`);
        }
        if (g.unstaged.length > 0) {
          lines.push("Changes not staged for commit:");
          for (const f of g.unstaged) lines.push(`\tmodified:   ${f}`);
        }
        return { output: lines.join("\n"), exitCode: 0 };
      }

      case "add": {
        // `git add .` (or any path) stages everything currently modified.
        g.staged = [...new Set([...g.staged, ...g.unstaged])];
        g.unstaged = [];
        return { output: "", exitCode: 0 };
      }

      case "commit": {
        const msg = this.flagValue(args, "-m") ?? "";
        if (g.staged.length === 0) {
          return {
            output: `On branch ${g.branch}\nnothing to commit, working tree clean`,
            exitCode: 1,
          };
        }
        const hash = shortHash(++this.counter);
        const count = g.staged.length;
        g.commits.push(hash);
        const files = count === 1 ? "1 file changed" : `${count} files changed`;
        g.staged = [];
        const summary = `[${g.branch} ${hash}] ${msg}\n ${files}`;
        return { output: summary, exitCode: 0 };
      }

      case "push": {
        const out = [
          "Enumerating objects: 5, done.",
          "Counting objects: 100% (5/5), done.",
          "Writing objects: 100% (3/3), 312 bytes, done.",
          `To github.com:dev/project.git`,
          `   ${shortHash(this.counter)}..${shortHash(this.counter + 1)}  ${g.branch} -> ${g.branch}`,
        ].join("\n");
        return { output: out, exitCode: 0 };
      }

      case "pull": {
        const out = [
          "remote: Enumerating objects: 3, done.",
          "Fast-forward",
          " src/index.ts | 2 +-",
          " 1 file changed, 1 insertion(+), 1 deletion(-)",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }

      case "checkout": {
        let target: string | undefined;
        let createNew = false;
        for (let i = 1; i < args.length; i++) {
          if (args[i] === "-b") {
            createNew = true;
          } else if (target === undefined) {
            target = args[i];
          }
        }
        if (!target) {
          return { output: "error: missing branch name", exitCode: 1 };
        }
        if (createNew) {
          g.branches.add(target);
          g.branch = target;
          return { output: `Switched to a new branch '${target}'`, exitCode: 0 };
        }
        g.branches.add(target);
        g.branch = target;
        return { output: `Switched to branch '${target}'`, exitCode: 0 };
      }

      case "merge": {
        const target = args[1];
        if (!target) {
          return { output: "fatal: No commit specified", exitCode: 1 };
        }
        const out = [
          `Updating ${shortHash(this.counter)}..${shortHash(this.counter + 1)}`,
          "Fast-forward",
          " src/index.ts | 4 ++++",
          " 1 file changed, 4 insertions(+)",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }

      case "log": {
        const entries =
          g.commits.length > 0
            ? g.commits
            : [shortHash(1), shortHash(2)];
        const lines: string[] = [];
        // Newest first, the way `git log` prints.
        for (let i = entries.length - 1; i >= 0; i--) {
          lines.push(`commit ${entries[i]}`);
          lines.push("Author: dev <dev@localhost>");
          lines.push("");
          lines.push("    work in progress");
          lines.push("");
        }
        return { output: lines.join("\n").trimEnd(), exitCode: 0 };
      }

      case "branch": {
        const names = [...g.branches].sort();
        const out = names
          .map((n) => (n === g.branch ? `* ${n}` : `  ${n}`))
          .join("\n");
        return { output: out, exitCode: 0 };
      }

      default:
        return {
          output: `git: '${sub ?? ""}' is not a git command. See 'git --help'.`,
          exitCode: 1,
        };
    }
  }

  // --- package managers ----------------------------------------------------

  private pkg(
    manager: string,
    args: string[],
  ): { output: string; exitCode: number } {
    const first = args[0];

    if (first === "install" || first === "i" || first === undefined) {
      const out = [
        "added 312 packages in 4s",
        "",
        "84 packages are looking for funding",
        `  run \`${manager} fund\` for details`,
      ].join("\n");
      return { output: out, exitCode: 0 };
    }

    if (first === "run") {
      return this.script(manager, args[1]);
    }

    if (first === "test") {
      return this.runTests();
    }

    // Treat a bare verb as a script name, matching real npm/pnpm/yarn behavior.
    return this.script(manager, first);
  }

  private script(
    manager: string,
    name: string | undefined,
  ): { output: string; exitCode: number } {
    switch (name) {
      case "dev": {
        const out = [
          `> ${manager} run dev`,
          "",
          "  ▲ Next.js 14.2.0",
          "  - Local:        http://localhost:3000",
          "",
          " ✓ Ready in 1.2s",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }
      case "build": {
        const out = [
          `> ${manager} run build`,
          "",
          " ✓ Compiled successfully",
          " ✓ Collecting page data",
          " ✓ Generating static pages (5/5)",
          "",
          "Route (app)                    Size     First Load JS",
          "┌ ○ /                          1.2 kB         92 kB",
          "└ ○ /about                     0.8 kB         91 kB",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }
      case "test":
        return this.runTests();
      default:
        if (!name) {
          return { output: `Usage: ${manager} run <script>`, exitCode: 1 };
        }
        return { output: `> ${manager} run ${name}\n\nDone.`, exitCode: 0 };
    }
  }

  private runTests(): { output: string; exitCode: number } {
    const out = [
      " ✓ src/index.test.ts (3 tests) 12ms",
      " ✓ src/util.test.ts (5 tests) 8ms",
      "",
      " Test Files  2 passed (2)",
      "      Tests  8 passed (8)",
    ].join("\n");
    return { output: out, exitCode: 0 };
  }

  // --- docker --------------------------------------------------------------

  private docker(args: string[]): { output: string; exitCode: number } {
    const sub = args[0];
    switch (sub) {
      case "ps": {
        const out = [
          "CONTAINER ID   IMAGE          COMMAND       STATUS         PORTS",
          "f3a9c1d2e4b5   project:dev    \"npm run …\"   Up 2 minutes   0.0.0.0:3000->3000/tcp",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }
      case "build": {
        const out = [
          "[+] Building 12.4s (10/10) FINISHED",
          " => [internal] load build definition from Dockerfile",
          " => exporting to image",
          " => => writing image sha256:7b1c3f",
          " => => naming to docker.io/library/project:latest",
        ].join("\n");
        return { output: out, exitCode: 0 };
      }
      case "run": {
        const id = shortHash(++this.counter) + shortHash(this.counter);
        return { output: id, exitCode: 0 };
      }
      default:
        return {
          output: "docker: unknown command. See 'docker --help'.",
          exitCode: 1,
        };
    }
  }

  // --- network -------------------------------------------------------------

  private curl(args: string[]): { output: string; exitCode: number } {
    const url = args.find((a) => !a.startsWith("-"));
    if (!url) {
      return { output: "curl: try 'curl --help' for more information", exitCode: 2 };
    }
    const out = [
      "HTTP/2 200 OK",
      "content-type: application/json",
      "",
      '{"status":"ok"}',
    ].join("\n");
    return { output: out, exitCode: 0 };
  }

  private vercel(args: string[]): { output: string; exitCode: number } {
    const prod = args.includes("--prod");
    const url = prod
      ? "https://project.vercel.app"
      : "https://project-git-main.vercel.app";
    const out = [
      "Vercel CLI 33.0.0",
      "🔍  Inspect: https://vercel.com/dev/project/inspect",
      `✅  ${prod ? "Production" : "Preview"}: ${url}`,
    ].join("\n");
    return { output: out, exitCode: 0 };
  }

  // --- coreutils -----------------------------------------------------------

  private ls(args: string[]): { output: string; exitCode: number } {
    const path = args.find((a) => !a.startsWith("-"));
    const target = path ?? this.vfs.cwd;
    if (!this.vfs.exists(target)) {
      return {
        output: `ls: cannot access '${target}': No such file or directory`,
        exitCode: 2,
      };
    }
    return { output: this.vfs.ls(target).join("\n"), exitCode: 0 };
  }

  private cat(args: string[]): { output: string; exitCode: number } {
    const path = args.find((a) => !a.startsWith("-"));
    if (!path) {
      return { output: "", exitCode: 0 };
    }
    const content = this.vfs.readFile(path);
    if (content === null) {
      return {
        output: `cat: ${path}: No such file or directory`,
        exitCode: 1,
      };
    }
    return { output: content.replace(/\n$/, ""), exitCode: 0 };
  }

  private cd(args: string[]): { output: string; exitCode: number } {
    const target = args[0] ?? "~";
    if (this.vfs.cd(target)) {
      return { output: "", exitCode: 0 };
    }
    return {
      output: `cd: ${target}: No such file or directory`,
      exitCode: 1,
    };
  }

  private grep(args: string[]): { output: string; exitCode: number } {
    // Strip flags; -r is implied since we always walk recursively here.
    const positional = args.filter((a) => !a.startsWith("-"));
    const pattern = positional[0];
    const where = positional[1] ?? ".";
    if (!pattern) {
      return { output: "usage: grep [-r] pattern path", exitCode: 2 };
    }

    const base = this.vfs.resolve(where);
    const files: string[] = [];
    if (this.vfs.readFile(base) !== null) {
      files.push(base);
    } else if (this.vfs.exists(base)) {
      this.collectFiles(base, files);
    }

    const matches: string[] = [];
    for (const file of files.sort()) {
      const content = this.vfs.readFile(file);
      if (content === null) continue;
      const display = this.relativeTo(file, where);
      const fileLines = content.split("\n");
      for (const fl of fileLines) {
        if (fl.includes(pattern)) {
          matches.push(`${display}:${fl}`);
        }
      }
    }

    return {
      output: matches.join("\n"),
      exitCode: matches.length > 0 ? 0 : 1,
    };
  }

  /** Recursively gather every file path under a directory. */
  private collectFiles(dir: string, out: string[]): void {
    for (const name of this.vfs.ls(dir)) {
      const full = dir === "/" ? "/" + name : dir + "/" + name;
      if (this.vfs.readFile(full) !== null) {
        out.push(full);
      } else if (this.vfs.exists(full)) {
        this.collectFiles(full, out);
      }
    }
  }

  /** Present an absolute path the way grep would, relative to the search arg. */
  private relativeTo(absFile: string, where: string): string {
    if (where === "." || where === "") {
      const cwd = this.vfs.cwd;
      const prefix = cwd === "/" ? "/" : cwd + "/";
      if (absFile.startsWith(prefix)) return absFile.slice(prefix.length);
    }
    const baseAbs = this.vfs.resolve(where);
    if (this.vfs.readFile(baseAbs) !== null) {
      // grep on a single file echoes the path the user typed.
      return where;
    }
    const prefix = baseAbs === "/" ? "/" : baseAbs + "/";
    if (absFile.startsWith(prefix)) {
      return where.replace(/\/$/, "") + "/" + absFile.slice(prefix.length);
    }
    return absFile;
  }

  private mkdir(args: string[]): { output: string; exitCode: number } {
    const dirs = args.filter((a) => !a.startsWith("-"));
    if (dirs.length === 0) {
      return { output: "mkdir: missing operand", exitCode: 1 };
    }
    for (const d of dirs) this.vfs.mkdir(d);
    return { output: "", exitCode: 0 };
  }

  // --- helpers -------------------------------------------------------------

  private flagValue(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
    return undefined;
  }
}
