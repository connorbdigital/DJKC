import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    /* The preview is served from a proxied host, and the Studio is also deployed
       on Vercel. Refusing unknown hosts breaks the preview, not an attack. */
    allowedHosts: true,
  },
  preview: { allowedHosts: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
