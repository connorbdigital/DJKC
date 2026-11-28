import { defineConfig } from "vitest/config";

/* The studio and commerce packages have their own vitest runs — keep them out of the site's suite. */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "studio/**", "commerce/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
