/**
 * A real page, made safe enough to hang in our own document.
 *
 * The problem this solves: an iframe pointed at someone else's site is refused
 * by most sites (`X-Frame-Options`, `frame-ancestors`), and even where it is
 * allowed, a cross-origin frame cannot be told to stop, styled, or trusted. So
 * the server fetches the page and this file turns it into something we can frame:
 *
 *  - the page's own **markup, stylesheets and pictures stay** — its real header,
 *    its real nav, its real hero. That is the point: this is the page, not a
 *    drawing of it;
 *  - a `<base>` points at the original address, so every relative link and image
 *    still resolves to the real site;
 *  - every `<script>`, every `on…` handler, every `javascript:` address, every
 *    nested frame and every `http-equiv="refresh"` is removed, because the HTML is
 *    served from our origin and a script from a stranger's page must never run
 *    there;
 *  - the iframe that shows it is sandboxed with no `allow-same-origin`, so even a
 *    script that survived the strip has an opaque origin and no way back in.
 *
 * What it is not: a browser. A page whose layout is drawn by JavaScript will show
 * its served state — usually its header and its first screen — not its hydrated
 * one. The plate is the fallback, and both carry the address so nobody mistakes
 * the picture for the site.
 */

export interface ProxiedPage {
  html: string;
  /** True when the page was longer than the ceiling and has been cut. */
  truncated: boolean;
}

/** A page is big. This is a header and a first screen, not an archive. */
export const MAX_PAGE_CHARS = 400_000;

const STRIP_BLOCKS: { tag: string; pattern: RegExp }[] = [
  { tag: "script", pattern: /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi },
  { tag: "script", pattern: /<script\b[^>]*\/>/gi },
  { tag: "noscript", pattern: /<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi },
  { tag: "iframe", pattern: /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi },
  { tag: "iframe", pattern: /<iframe\b[^>]*\/?>/gi },
  { tag: "object", pattern: /<object\b[^>]*>[\s\S]*?<\/object\s*>/gi },
  { tag: "embed", pattern: /<embed\b[^>]*\/?>/gi },
  { tag: "base", pattern: /<base\b[^>]*\/?>/gi },
  { tag: "meta", pattern: /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi },
];

/** `onclick="…"`, `onerror='…'`, `onload=…` — every one of them. */
const ON_ATTRIBUTE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** `href="javascript:…"` and `src="javascript:…"`, however they are spelled. */
const SCRIPT_URL = /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi;

/** A `<base>` of our own, and the charset, so the page's bytes are read the same way. */
function headInjection(url: string): string {
  const href = url.replace(/"/g, "&quot;");
  return `<base href="${href}"><meta charset="utf-8"><style>html{-webkit-text-size-adjust:100%}</style>`;
}

/**
 * The whole transformation. Pure: text in, text out, no fetch, no DOM — so it can
 * be tested without a browser and reasoned about without one either.
 */
export function proxyPage(raw: string, url: string): ProxiedPage {
  const truncated = raw.length > MAX_PAGE_CHARS;
  let html = truncated ? raw.slice(0, MAX_PAGE_CHARS) : raw;

  for (const { pattern } of STRIP_BLOCKS) html = html.replace(pattern, "");
  html = html.replace(ON_ATTRIBUTE, "");
  html = html.replace(SCRIPT_URL, ' $1="#"');
  /* Comments are the usual hiding place for a conditional script. */
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  const injection = headInjection(url);
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (match) => `${match}${injection}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
  } else {
    html = `<!doctype html><html><head>${injection}</head><body>${html}</body></html>`;
  }

  if (truncated) {
    /* Say so in the page: a cut page that looks complete is the one dishonest
       thing this file could do. A page cut in the middle of its body has no
       closing tag to put the notice before, so it goes on the end. */
    const notice = `<p style="margin:0;padding:.6rem 1rem;font:13px/1.4 system-ui,sans-serif;color:#111;background:#fff8d6;border-top:1px solid #e6d48a">This page was longer than the reader allows, so it is shown cut off. <a href="${url.replace(/"/g, "&quot;")}">Open the whole page</a>.</p>`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${notice}</body>`) : `${html}${notice}</body></html>`;
  }

  return { html, truncated };
}

/** The headers the endpoint must send with it. Scripts are refused twice over. */
export const PAGE_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'none'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; media-src *; form-action 'none'; base-uri *",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "public, max-age=600, s-maxage=3600",
};
