/**
 * `GET /api/readiness` — what is configured, what is not, and the one next step.
 *
 * Public on purpose: it names variables and never returns a value, and it is the
 * fastest answer to "why did the shop take the money and do nothing". If you would
 * rather it were not public, gate it on a header — but a build that reports its
 * own gaps is more useful than one that hides them.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { readiness } from "../src/readiness.js";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ ok: false, error: "Use GET." }));
    return;
  }
  const report = readiness(process.env as Record<string, string | undefined>);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: true, ...report }));
}
