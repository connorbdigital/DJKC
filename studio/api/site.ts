import type { IncomingMessage, ServerResponse } from "node:http";
import { checkSite, checkUrl, pagePreview } from "../src/sitecheck.js";
import { internalLinks } from "../src/atlasSpace.js";
import { pageFacts } from "../src/plate.js";

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
const MAX_IMAGE_BYTES = 2_500_000;

const json = (res: ServerResponse, status: number, body: unknown, cache = "no-store") => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
};

/** A link card changes about as often as a page does, so an hour here is generous. */
const CARD_CACHE = "public, max-age=3600, s-maxage=86400";
/** A plate is the page's own picture; a day is honest, and a week at the edge is not a lie. */
const PLATE_CACHE = "public, max-age=3600, s-maxage=86400";
const IMAGE_CACHE = "public, max-age=86400, s-maxage=604800";

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

type ImageResult = { ok: true; body: Buffer; type: string } | { ok: false; status: number; error: string };

/**
 * One image, for a page's own picture on a plate.
 *
 * It is fetched here for one reason: an `<img>` from another origin is fine in a
 * page but unusable on a canvas in WebGL — the canvas is tainted and the texture
 * refuses to upload. Same-origin bytes are the only way a page's picture can
 * become part of the scene. Nothing is resized or re-encoded: the picture the
 * page chose is the picture that is drawn.
 */
async function readImage(target: URL, signal: AbortSignal): Promise<ImageResult> {
  const response = await fetch(target.toString(), {
    signal,
    headers: {
      "User-Agent": "KC-Studio plate (+https://github.com/connorbdigital/DJKC)",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8",
    },
  });
  if (!response.ok) return { ok: false, status: 404, error: `That picture answered ${response.status}.` };

  const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!type.startsWith("image/")) {
    return { ok: false, status: 415, error: `That address is ${type || "not an image"}, so it cannot be a picture.` };
  }
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "That picture is too large to draw." };

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "That picture is too large to draw." };
  return { ok: true, body, type };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  /* GET ?thumb=<url>: the card a link would make, for the space to draw. */
  if (req.method === "GET") {
    const params = new URL(req.url ?? "/", "https://studio.invalid").searchParams;

    /* ?image=<url>: the bytes of a page's own picture, same-origin, so a canvas
       may take them. Cached hard: a share picture rarely changes. */
    const imageAsked = params.get("image") ?? "";
    if (imageAsked) {
      const verdict = checkUrl(imageAsked);
      if (!verdict.ok || !verdict.url) {
        json(res, 400, { ok: false, error: verdict.reason ?? "That picture cannot be read." });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const image = await readImage(verdict.url, controller.signal);
        if (!image.ok) {
          json(res, image.status, { ok: false, error: image.error });
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", image.type);
        res.setHeader("Content-Length", String(image.body.byteLength));
        res.setHeader("Cache-Control", IMAGE_CACHE);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(image.body);
      } catch (problem) {
        const aborted = problem instanceof Error && problem.name === "AbortError";
        json(res, aborted ? 504 : 502, { ok: false, error: aborted ? "That picture took too long." : "That picture could not be read." });
      } finally {
        clearTimeout(timer);
      }
      return;
    }

    /* ?plate=<url>: what the page looks like, from the page itself. The picture
       is rewritten to this same endpoint so the browser can draw it. */
    const plateAsked = params.get("plate") ?? "";
    if (plateAsked) {
      const verdict = checkUrl(plateAsked);
      if (!verdict.ok || !verdict.url) {
        json(res, 400, { ok: false, error: verdict.reason ?? "That page cannot be read." });
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
        const facts = pageFacts(page.html, verdict.url.toString());
        json(
          res,
          200,
          {
            ok: true,
            plate: {
              ...facts,
              image: facts.image ? `/api/site?image=${encodeURIComponent(facts.image)}` : null,
              truncated: page.truncated,
            },
          },
          PLATE_CACHE
        );
      } catch (problem) {
        const aborted = problem instanceof Error && problem.name === "AbortError";
        json(res, aborted ? 504 : 502, { ok: false, error: aborted ? "That page took too long to answer." : "That page could not be read." });
      } finally {
        clearTimeout(timer);
      }
      return;
    }

    const asked = params.get("thumb") ?? "";
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
  let payload: { url?: unknown; links?: unknown };
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { url?: unknown; links?: unknown };
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
    /* The City asks for `links` when it opens a project's space: the anchors on
       this page that stay on this site, which are the streams between stars. */
    if (payload.links === true) {
      json(res, 200, { ok: true, links: internalLinks(html, target.toString(), 40), truncated: page.truncated });
      return;
    }
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
