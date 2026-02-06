import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
    singleFork: true,
    testTimeout: 30000,
  },
});
