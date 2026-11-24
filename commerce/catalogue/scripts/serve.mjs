import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

/** Static server for the built catalogue: no framework, no build step. */
const root = path.resolve("catalogue/dist");
const port = Number(process.env.PORT ?? 4300);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

http
  .createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let filePath = path.join(root, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("No.");
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
    if (!existsSync(filePath)) {
      response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      response.end("<h1>404</h1><p>No such page. <a href='/'>Back to the catalogue</a>.</p>");
      return;
    }
    response.writeHead(200, { "content-type": types[path.extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  })
  .listen(port, "0.0.0.0", () => console.log(`catalogue on http://0.0.0.0:${port}`));
