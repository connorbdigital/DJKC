import { detectProfile, type ImportProfile } from "./importProducts";
import { parseCsv } from "./csv";

/**
 * Fetching a supplier feed without leaking the credentials in it.
 *
 * Supplier feed URLs carry the account in the query string or the path
 * (`?u=you@example.com`, `/feeds/8f3c…csv`), and some want an Authorization
 * header. Anything that gets logged, committed or pasted into a chat has to be
 * redacted first — this is the function that does it.
 */

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

/** HTTPS only, no credentials in the URL, no local or private hosts. */
export function checkFeedUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "that is not a URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "feeds must be fetched over https" };
  if (url.username || url.password) return { ok: false, reason: "put the account in --user/--pass or --header, not in the URL" };
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local")) {
    return { ok: false, reason: "that is a local address, not a supplier" };
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return { ok: false, reason: "that is a private address" };
  return { ok: true };
}

/**
 * Keeps the host and path shape, hides the account: query values become ***,
 * and a long opaque last path segment is collapsed too.
 */
export function redactUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "<not a url>";
  }
  const segments = url.pathname.split("/").map((segment) =>
    /* A 24+ character segment with no dot in it is a token far more often than a file name. */
    segment.length >= 24 && !segment.includes(".") ? "***" : segment
  );
  const params = [...url.searchParams.keys()].map((key) => `${key}=***`);
  const query = params.length ? `?${params.join("&")}` : "";
  return `${url.origin}${segments.join("/")}${query}`;
}

export interface FeedSummary {
  bytes: number;
  rows: number;
  columns: string[];
  /** Which supplier shape the header row looks like. */
  profile?: Pick<ImportProfile, "id" | "label">;
  /** True when the header row looks like product data rather than an order or stock file. */
  looksLikeProducts: boolean;
  ragged: number;
}

/** A price or a title is what separates a product file from a stock file keyed by SKU. */
const PRODUCTISH = ["title", "name", "product", "description", "price", "rrp", "image", "ean", "barcode"];

export function describeFeed(text: string): FeedSummary {
  const table = parseCsv(text);
  const headerSet = new Set(table.headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const looksLikeProducts = PRODUCTISH.some((field) => [...headerSet].some((header) => header.includes(field)));
  const { profile } = detectProfile(table.headers);
  return {
    bytes: new TextEncoder().encode(text).length,
    rows: table.rows.length,
    columns: table.headers,
    profile: profile ? { id: profile.id, label: profile.label } : undefined,
    looksLikeProducts,
    ragged: table.ragged,
  };
}

/** `aosom-2026-11-20.csv` — dated, so yesterday's file is still on disk to compare. */
export function feedFileName(name: string, date: Date): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "supplier";
  const stamp = date.toISOString().slice(0, 10);
  return `${safe}-${stamp}.csv`;
}

export interface FeedRecord {
  file: string;
  url: string;
  fetchedAt: string;
  bytes: number;
  sha256: string;
  rows: number;
  columns: string[];
  profile: string;
  ragged: number;
}

export interface FeedManifest {
  feeds: FeedRecord[];
}

/** Newest first, one record per file, capped so the manifest stays readable. */
export function mergeManifest(existing: FeedManifest | undefined, entry: FeedRecord, cap = 60): FeedManifest {
  const feeds = [entry, ...(existing?.feeds ?? []).filter((record) => record.file !== entry.file)];
  return { feeds: feeds.slice(0, cap) };
}
