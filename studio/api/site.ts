import type { IncomingMessage, ServerResponse } from "node:http";
import { checkSite, checkUrl } from "../src/sitecheck";

/**
 * Fetches one public https page and returns a summary of it.
 *
 * Why a server is involved at all: a browser cannot read another site's HTML
 * because of CORS, and proxying through the browser would be worse. So the
 * request is made here, with the guard in src/sitecheck.ts (https only, public
 * hosts only, no credentials, default port only), a timeout, a byte ceiling
 * and no redirects followed. The HTML never reaches the browser — only the
 * audit does.
 *
 * Known limit: a hostname can resolve to a private address after the check.
 * Run this with restricted egress if that matters; do not treat it as a
 * security boundary.
 */

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST." });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  let payload: { url?: unknown };
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { url?: unknown };
  } catch {
    json(res, 400, { ok: false, error: "That request was not JSON." });
    return;
  }

  const verdict = checkUrl(typeof payload.url === "string" ? payload.url : "");
  if (!verdict.ok || !verdict.url) {
    json(res, 400, { ok: false, error: verdict.reason ?? "That URL cannot be checked." });
    return;
  }
  const target = verdict.url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(target.toString(), {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "KC-Studio site check (+https://github.com/connorbdigital/DJKC)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      json(res, 400, { ok: false, error: `That page redirects (${response.status}). Enter the final address.` });
      return;
    }
    if (!response.ok) {
      json(res, 400, { ok: false, error: `That page answered ${response.status}.` });
      return;
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) {
      json(res, 400, { ok: false, error: `That address is ${type.split(";")[0] || "not HTML"}, not a web page.` });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      json(res, 502, { ok: false, error: "That page had no content." });
      return;
    }
    const parts: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      parts.push(value);
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(parts.map((part) => Buffer.from(part))));
    const report = checkSite(html, target.toString());
    json(res, 200, { ok: true, report: { ...report, truncated } });
  } catch (problem) {
    const aborted = problem instanceof Error && problem.name === "AbortError";
    json(res, aborted ? 504 : 502, {
      ok: false,
      error: aborted ? "That page took too long to answer." : "That page could not be read.",
    });
  } finally {
    clearTimeout(timer);
  }
}
