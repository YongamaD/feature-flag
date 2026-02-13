import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@feature-flags/evaluator": path.resolve(
        __dirname,
        "packages/evaluator/src/index.ts"
      ),
      "@feature-flags/sdk": path.resolve(
        __dirname,
        "packages/sdk/src/index.ts"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**", "apps/*/src/**"],
    },
  },
});
