import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The fixtures are sample projects for the indexer, not tests of this repo.
    exclude: ["tests/fixtures/**", "node_modules/**", "dist/**"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});
