import { defineConfig } from "vitest/config";

/* The studio package has its own vitest run — keep it out of the site's suite. */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "studio/**"],
  },
});
