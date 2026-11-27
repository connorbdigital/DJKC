import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * The `api/` handlers, served in development.
 *
 * On Vercel these files *are* the endpoints. `vite dev` knows nothing about
 * them, which meant every feature that reads a page — the link card, the audit,
 * and now the plates — could only be tried after a deploy. This plugin calls the
 * same default export with the same Node request and response, so development
 * and production run one implementation rather than two.
 *
 * It is `apply: "serve"`: nothing here reaches a build.
 */
function apiInDev(): Plugin {
  return {
    name: "studio-api-in-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        const name = path.match(/^\/api\/([a-z0-9-]+)$/)?.[1];
        if (!name) {
          next();
          return;
        }
        void (async () => {
          try {
            const module = (await server.ssrLoadModule(`/api/${name}.ts`)) as {
              default?: (request: typeof req, response: typeof res) => Promise<void> | void;
            };
            if (typeof module.default !== "function") {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ ok: false, error: `api/${name}.ts has no default export.` }));
              return;
            }
            await module.default(req, res);
          } catch (problem) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: `api/${name} failed in development: ${problem instanceof Error ? problem.message : "unknown error"}`,
              })
            );
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiInDev()],
  /* Stamped into the bundle, so "am I looking at the new build?" has an answer
     that is not a guess. It appears in the Atlas's own footer. */
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace("T", " ")),
  },
  build: { outDir: "dist" },
  server: {
    /* The preview is served from a proxied host, and the Studio is also deployed
       on Vercel. Refusing unknown hosts breaks the preview, not an attack. */
    allowedHosts: true,
  },
  preview: { allowedHosts: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
