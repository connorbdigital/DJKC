/**
 * Reading a competitor's page — deliberately narrow.
 *
 * This is the only part of the Studio that asks a server to fetch a URL the
 * user typed, so it is written to be boring: https only, public hosts only, a
 * timeout, a size cap, no redirects followed off-site, no HTML returned to the
 * browser — just a summary of what the page says about itself.
 *
 * It is a best-effort guard, not a security boundary. A DNS name can resolve
 * to a private address after this check, so the function should also run with
 * restricted egress. That limitation is stated here rather than hidden.
 */

export interface UrlVerdict {
  ok: boolean;
  url?: URL;
  reason?: string;
}

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home.arpa", ".test", ".example", ".invalid"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata", "instance-data"]);

export function checkUrl(raw: string): UrlVerdict {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Enter a URL." };
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "That is not a URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only https addresses can be checked." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not accepted." };
  }
  if (url.port && url.port !== "443") {
    return { ok: false, reason: "Only the default https port is accepted." };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, reason: "That host is not public." };
  }
  if (host.startsWith("[") || host.includes(":")) {
    return { ok: false, reason: "IPv6 literals are not accepted; use a domain name." };
  }
  /* 127.0.0.1, 10.0.0.1, and the decimal and hex aliases of them. */
  const octet = "(?:\\d+|0x[0-9a-f]+)";
  if (new RegExp(`^${octet}$|^${octet}(?:\\.${octet}){3}$`, "i").test(host)) {
    return { ok: false, reason: "IP addresses are not accepted; use a domain name." };
  }
  if (!host.includes(".")) return { ok: false, reason: "That host is not public." };
  return { ok: true, url };
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface SiteCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Why it matters, in one line. */
  because: string;
}

export interface SiteReport {
  url: string;
  title: string;
  description: string;
  h1: string[];
  words: number;
  jsonLd: string[];
  checks: SiteCheck[];
  verdict: string;
}

const stripTags = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const decode = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const metaContent = (html: string, name: string): string => {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const reversed = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decode(html.match(pattern)?.[1] ?? html.match(reversed)?.[1] ?? "");
};

/** Turns one page of HTML into the audit a shop owner can act on. */
export function checkSite(html: string, url: string): SiteReport {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, "description");
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decode(stripTags(match[1] ?? ""))).filter(Boolean);
  const words = stripTags(html).split(" ").filter(Boolean).length;
  const jsonLd = [
    ...new Set(
      [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
        .flatMap((match) => [...(match[1] ?? "").matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((type) => type[1] ?? ""))
        .filter(Boolean)
    ),
  ];
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imagesMissingAlt = images.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;

  const checks: SiteCheck[] = [
    {
      id: "title",
      label: "Page title",
      status: !title ? "fail" : title.length > 60 ? "warn" : title.length < 15 ? "warn" : "pass",
      detail: title ? `${title.length} characters: “${title}”` : "No title tag.",
      because: "the title is what a search result, a share card and an AI answer quote",
    },
    {
      id: "description",
      label: "Meta description",
      status: !description ? "fail" : description.length > 155 ? "warn" : description.length < 70 ? "warn" : "pass",
      detail: description ? `${description.length} characters` : "No description.",
      because: "it is the sentence a shopper decides whether to click",
    },
    {
      id: "h1",
      label: "Headline",
      status: h1.length === 1 ? "pass" : h1.length === 0 ? "fail" : "warn",
      detail: h1.length ? `${h1.length} h1 element${h1.length === 1 ? "" : "s"}: “${h1[0]!.slice(0, 80)}”` : "No h1.",
      because: "one clear headline is the page's subject; none or many leaves it ambiguous",
    },
    {
      id: "product",
      label: "Product markup",
      status: jsonLd.includes("Product") ? "pass" : "fail",
      detail: jsonLd.length ? `JSON-LD types: ${jsonLd.join(", ")}` : "No JSON-LD at all.",
      because: "agents and Shopping surfaces read structured data before they read copy",
    },
    {
      id: "offer",
      label: "Price and availability",
      status: jsonLd.includes("Offer") || jsonLd.includes("AggregateOffer") ? "pass" : "warn",
      detail: /"price"\s*:/i.test(html) ? "A price is published in structured data." : "No machine-readable price.",
      because: "a product without an Offer cannot be compared or bought by an agent",
    },
    {
      id: "returns",
      label: "Return policy",
      status: jsonLd.includes("MerchantReturnPolicy") ? "pass" : "warn",
      detail: /return/i.test(html) ? "Returns are mentioned in the page." : "No returns information found.",
      because: "return terms are read before purchase and expected by shopping feeds",
    },
    {
      id: "images",
      label: "Image alt text",
      status: images.length === 0 ? "warn" : imagesMissingAlt === 0 ? "pass" : imagesMissingAlt > images.length / 2 ? "fail" : "warn",
      detail: `${images.length} images, ${imagesMissingAlt} without alt text`,
      because: "missing alt text is among the most common accessibility failures in retail",
    },
    {
      id: "viewport",
      label: "Mobile viewport",
      status: metaContent(html, "viewport") ? "pass" : "fail",
      detail: metaContent(html, "viewport") || "No viewport meta tag.",
      because: "without it a phone renders a desktop page at desktop width",
    },
    {
      id: "canonical",
      label: "Canonical URL",
      status: /rel=["']canonical["']/i.test(html) ? "pass" : "warn",
      detail: /rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.test(html)
        ? (html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? "")
        : "None declared.",
      because: "duplicate URLs split ranking and confuse feeds",
    },
    {
      id: "social",
      label: "Share card",
      status: metaContent(html, "og:title") && metaContent(html, "og:image") ? "pass" : "warn",
      detail: metaContent(html, "og:image") ? "Open Graph image present." : "No og:image.",
      because: "links posted to social and messaging show the card, not the page",
    },
    {
      id: "content",
      label: "Readable content",
      status: words < 80 ? "fail" : words < 200 ? "warn" : "pass",
      detail: `${words.toLocaleString("en-GB")} words of text outside scripts and styles`,
      because: "a page with almost no text has nothing to rank or quote",
    },
    {
      id: "speed",
      label: "Page weight signals",
      status: html.length > 900_000 ? "warn" : "pass",
      detail: `${(html.length / 1024).toFixed(0)} kB of HTML`,
      because: "an oversized document delays first paint on a phone",
    },
  ];

  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const verdict = failures
    ? `${failures} thing${failures === 1 ? "" : "s"} to fix${warnings ? ` and ${warnings} to look at` : ""}.`
    : warnings
      ? `Nothing broken, ${warnings} worth improving.`
      : "Everything checked looks right.";

  return { url, title, description, h1, words, jsonLd, checks, verdict };
}
