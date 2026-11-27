import type { PageFacts } from "./plate";

/**
 * The client side of the plate endpoint.
 *
 * Three rules, all of them about not making the space slower than it already is:
 *  - one request per URL per session, ever (the promise is cached, not the result,
 *    so two callers waiting on the same page share one fetch);
 *  - a plate that arrives once is kept for the tab, and for the next tab if it is
 *    still fresh;
 *  - a plate that fails is a plate that is missing, never an error on screen. The
 *    stars are the space; a picture is an addition to it.
 */

export interface Plate extends PageFacts {
  /** Same-origin URL of the page's own picture, or null. */
  image: string | null;
  /** True when the page was longer than the ceiling the reader allows. */
  truncated?: boolean;
}

const ENDPOINT = "/api/site?plate=";
const STORE = "studio-plates-v1";
const STORE_LIMIT = 48;
const FRESH_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 9_000;

const settled = new Map<string, Plate | null>();
const inflight = new Map<string, Promise<Plate | null>>();
let stored: Record<string, { at: number; plate: Plate }> | null = null;

/** Only a plate-shaped payload is allowed in: a proxy error with a 200 is still an error. */
export function isPlate(value: unknown): value is Plate {
  if (!value || typeof value !== "object") return false;
  const plate = value as Partial<Plate>;
  return (
    typeof plate.url === "string" &&
    typeof plate.title === "string" &&
    typeof plate.h1 === "string" &&
    Array.isArray(plate.palette) &&
    plate.palette.every((colour) => typeof colour === "string" && /^#[0-9a-f]{6}$/i.test(colour)) &&
    (plate.image === null || typeof plate.image === "string")
  );
}

function readStore(): Record<string, { at: number; plate: Plate }> {
  if (stored) return stored;
  stored = {};
  try {
    const raw = sessionStorage.getItem(STORE);
    if (!raw) return stored;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return stored;
    for (const [url, entry] of Object.entries(parsed as Record<string, { at: number; plate: Plate }>)) {
      if (entry && typeof entry.at === "number" && isPlate(entry.plate)) stored[url] = entry;
    }
  } catch {
    /* A tab with no storage is a tab that fetches. Nothing to do. */
  }
  return stored;
}

function writeStore(url: string, plate: Plate) {
  const all = readStore();
  all[url] = { at: Date.now(), plate };
  const entries = Object.entries(all);
  if (entries.length > STORE_LIMIT) {
    entries.sort((a, b) => b[1].at - a[1].at);
    for (const [key] of entries.slice(STORE_LIMIT)) delete all[key];
  }
  try {
    sessionStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* Full or refused: the memory cache above still holds this session's plates. */
  }
}

/** A plate already known, with no request: what a fresh mount can draw immediately. */
export function knownPlate(url: string): Plate | null {
  const settledPlate = settled.get(url);
  if (settledPlate) return settledPlate;
  const entry = readStore()[url];
  if (entry && Date.now() - entry.at < FRESH_MS) {
    settled.set(url, entry.plate);
    return entry.plate;
  }
  return null;
}

export function loadPlate(url: string): Promise<Plate | null> {
  const known = knownPlate(url);
  if (known) return Promise.resolve(known);
  const already = inflight.get(url);
  if (already) return already;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const request = fetch(`${ENDPOINT}${encodeURIComponent(url)}`, { signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) return null;
      const body: unknown = await response.json();
      const plate = (body as { plate?: unknown })?.plate;
      if (!isPlate(plate)) return null;
      settled.set(url, plate);
      writeStore(url, plate);
      return plate;
    })
    .catch(() => null)
    .finally(() => {
      clearTimeout(timer);
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
}

/** Test seam: forget everything, so a suite does not leak between cases. */
export function forgetPlates() {
  settled.clear();
  inflight.clear();
  stored = null;
  try {
    sessionStorage.removeItem(STORE);
  } catch {
    /* nothing stored, nothing to forget */
  }
}
