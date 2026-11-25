import type { IncomingMessage, ServerResponse } from "node:http";
import { checkSite, checkUrl, pagePreview } from "../src/sitecheck";

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

const json = (res: ServerResponse, status: number, body: unknown, cache = "no-store") => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
};

/** A link card changes about as often as a page does, so an hour here is generous. */
const CARD_CACHE = "public, max-age=3600, s-maxage=86400";

type PageResult = { ok: true; html: string; truncated: boolean } | { ok: false; status: number; error: string };

/** One guarded fetch, shared by the audit (POST) and the preview (GET). */
async function readPage(target: URL, signal: AbortSignal): Promise<PageResult> {
  const response = await fetch(target.toString(), {
    redirect: "manual",
    signal,
    headers: {
      "User-Agent": "KC-Studio site check (+https://github.com/connorbdigital/DJKC)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    return { ok: false, status: 400, error: `That page redirects (${response.status}). Enter the final address.` };
  }
  if (!response.ok) return { ok: false, status: 400, error: `That page answered ${response.status}.` };

  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) {
    return { ok: false, status: 400, error: `That address is ${type.split(";")[0] || "not HTML"}, not a web page.` };
  }

  const reader = response.body?.getReader();
  if (!reader) return { ok: false, status: 502, error: "That page had no content." };

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
  return { ok: true, html, truncated };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  /* GET ?thumb=<url>: the card a link would make, for the space to draw. */
  if (req.method === "GET") {
    const asked = new URL(req.url ?? "/", "https://studio.invalid").searchParams.get("thumb") ?? "";
    const verdict = checkUrl(asked);
    if (!verdict.ok || !verdict.url) {
      json(res, 400, { ok: false, error: verdict.reason ?? "That URL cannot be read." });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const page = await readPage(verdict.url, controller.signal);
      if (!page.ok) {
        json(res, page.status, { ok: false, error: page.error });
        return;
      }
      json(res, 200, { ok: true, preview: pagePreview(page.html, verdict.url.toString()) }, CARD_CACHE);
    } catch (problem) {
      const aborted = problem instanceof Error && problem.name === "AbortError";
      json(res, aborted ? 504 : 502, { ok: false, error: aborted ? "That page took too long to answer." : "That page could not be read." });
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST to audit a page, or GET ?thumb=<url> for its card." });
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
    const page = await readPage(target, controller.signal);
    if (!page.ok) {
      json(res, page.status, { ok: false, error: page.error });
      return;
    }
    const { html } = page;
    const report = checkSite(html, target.toString());
    json(res, 200, { ok: true, report: { ...report, truncated: page.truncated } });
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
