import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Components need a DOM; everything else runs in fast Node.
    environmentMatchGlobs: [["src/components/**", "jsdom"]],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/engine/**", "src/sandbox/**", "src/persistence/**", "src/sync/**"],
      thresholds: {
        "src/engine/**/*.ts": { lines: 85, functions: 85, branches: 80, statements: 85 },
      },
    },
  },
});
