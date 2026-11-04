import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // One worker per file was costing ~700 ms of spawn per file (121 files);
    // these are pure-function suites with no shared module state, so they can
    // share workers. Verified 2026-11-04: the full suite passes either way,
    // in half the time (26 s -> 12 s locally).
    isolate: false,
  },
})
