import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      include: [
        "src/lib/**",
        "src/components/games/**",
        "src/components/statistics/**",
        "src/components/nav.tsx",
        "src/app/api/**",
      ],
      exclude: [
        "src/components/ui/**",
        "src/lib/db/index.ts",
        "src/lib/auth/types.ts",
        "src/lib/auth/index.ts",
        "src/lib/providers.tsx",
        "src/lib/utils.ts",
        "src/lib/__tests__/**",
        "src/lib/db/schema.ts",
        "src/app/api/auth/\\[...nextauth\\]/**",
      ],
    },
  },
});
