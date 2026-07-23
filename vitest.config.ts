import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror tsconfig's `@/*` → repo root so the pure layer's imports resolve.
    alias: [{ find: /^@\//, replacement: rootDir }],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
