/**
 * The world: what the space is made of, and how old each part of it is.
 *
 * The Atlas used to be a picture of the repository. Every star was compiled in,
 * so the only way to change the space was to deploy it again. This file is the
 * other half of the fix: `/api/world` builds a snapshot on the server, and this
 * is the browser's reading of it — validated like anything else that crossed a
 * network, versioned so a poll can tell whether anything actually changed, and
 * honest about which sources answered and which did not.
 *
 * Pure functions, so the rules are testable in node without a browser or a
 * serverless function.
 */
import type { AnythingApp } from "./anythingClient";

export type SourceId = "studio" | "anything" | "vercel" | "github" | "sites";

/** One thing the space is fed by, and whether it answered. */
export interface WorldSource {
  id: SourceId;
  label: string;
  /** Did this source answer? An empty answer is not a failure; no answer is. */
  ok: boolean;
  /** When it last answered, in ms. 0 means never. */
  at: number;
  /** One sentence for the HUD and the beacon: "2 apps", "no token on this project". */
  note: string;
  /** How many things it contributed, where a number means something. */
  count?: number;
}

export interface WorldDeployment {
  name: string;
  url: string;
  state: string;
  commit: string | null;
  at: number;
}

export interface WorldSnapshot {
  /** Changes only when the *content* changes — not every time it is polled. */
  version: string;
  /** When this snapshot was built on the server. */
  builtAt: number;
  sources: WorldSource[];
  apps: AnythingApp[];
  deployments: WorldDeployment[];
  counts: { nodes: number; edges: number; districts: number; apps: number; deployments: number };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, limit = 200): string =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

/**
 * A version for a world.
 *
 * It is a hash of the things that would change what you see — the node ids, the
 * apps and their module counts, the deployments — and nothing else. Polling the
 * same world twice must not look like a change, or every sixty seconds the whole
 * space would be rebuilt for nothing.
 */
export function worldVersion(input: {
  nodes: { id: string }[];
  apps: { name: string; modules: string[] }[];
  deployments: { url: string; state: string }[];
}): string {
  const parts = [
    ...input.nodes.map((node) => node.id).sort(),
    ...input.apps.map((app) => `${app.name}:${app.modules.length}`).sort(),
    ...input.deployments.map((entry) => `${entry.url}:${entry.state}`).sort(),
  ];
  /* FNV-1a, 32 bits, base 36: short, stable, and no dependency does it better
     for a value that only ever has to be compared with itself. */
  let hash = 0x811c9dc5;
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${parts.length.toString(36)}-${hash.toString(36)}`;
}

/** A world that has answered a request, read defensively. Null when it is not one. */
export function readWorld(payload: unknown): WorldSnapshot | null {
  if (!isRecord(payload)) return null;
  const raw = isRecord(payload.world) ? payload.world : payload;
  const version = text(raw.version, 40);
  if (!version) return null;
  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter(isRecord).reduce<WorldSource[]>((list, entry) => {
        const id = text(entry.id, 20) as SourceId;
        if (!["studio", "anything", "vercel", "github", "sites"].includes(id)) return list;
        list.push({
          id,
          label: text(entry.label, 40) || id,
          ok: entry.ok === true,
          at: count(entry.at),
          note: text(entry.note, 200),
          count: typeof entry.count === "number" ? count(entry.count) : undefined,
        });
        return list;
      }, [])
    : [];
  return {
    version,
    builtAt: count(raw.builtAt),
    sources,
    apps: readApps(raw.apps),
    deployments: Array.isArray(raw.deployments)
      ? raw.deployments.filter(isRecord).map((entry) => ({
          name: text(entry.name, 60),
          url: text(entry.url, 200),
          state: text(entry.state, 20),
          commit: text(entry.commit, 40) || null,
          at: count(entry.at),
        }))
      : [],
    counts: isRecord(raw.counts)
      ? {
          nodes: count(raw.counts.nodes),
          edges: count(raw.counts.edges),
          districts: count(raw.counts.districts),
          apps: count(raw.counts.apps),
          deployments: count(raw.counts.deployments),
        }
      : { nodes: 0, edges: 0, districts: 0, apps: 0, deployments: 0 },
  };
}

/** Apps from the world, in the same shape the browser's own loader returns. */
export function readApps(value: unknown): AnythingApp[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).reduce<AnythingApp[]>((list, entry) => {
    const name = text(entry.name, 80);
    if (!name) return list;
    const modules = Array.isArray(entry.modules) ? entry.modules.map((item) => text(item, 80)).filter(Boolean) : [];
    list.push({
      id: text(entry.id, 80) || `app-${name}`,
      name,
      organizationName: text(entry.organizationName, 80),
      platform: text(entry.platform, 20) || "web",
      modules,
      moduleCount: typeof entry.moduleCount === "number" ? count(entry.moduleCount) : modules.length,
      url: text(entry.url, 300) || undefined,
      updatedAt: text(entry.updatedAt, 40),
    });
    return list;
  }, []);
}

/** Does this poll tell us anything new? */
export function sameWorld(a: WorldSnapshot | null, b: WorldSnapshot | null): boolean {
  if (!a || !b) return a === b;
  return a.version === b.version;
}

export type WorldTone = "none" | "live" | "partial" | "stale";

/**
 * How the world stands.
 *
 * "Stale" is not "wrong": a snapshot that is an hour old is still true about an
 * hour ago. It is the sentence the HUD says, not a claim that the space is
 * broken.
 */
export function worldTone(world: WorldSnapshot | null, now = Date.now()): WorldTone {
  if (!world) return "none";
  if (now - world.builtAt > 15 * 60_000) return "stale";
  const failed = world.sources.filter((source) => !source.ok);
  if (!failed.length) return "live";
  /* The studio's own inventory is always there; a missing third party is a
     partial world, not a broken one. */
  return failed.length === world.sources.length ? "stale" : "partial";
}

const clock = (at: number): string => {
  if (!at) return "never";
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/** The one line the HUD shows: what the space is made of, and how old it is. */
export function describeWorld(world: WorldSnapshot | null): string {
  if (!world) return "Local build — the world snapshot has not answered.";
  const ok = world.sources.filter((source) => source.ok).length;
  const parts = [
    `${world.counts.nodes} stars`,
    `${world.counts.edges} wires`,
    `${ok}/${world.sources.length} sources`,
    `built ${clock(world.builtAt)}`,
  ];
  return parts.join(" · ");
}

/**
 * The chip's own words: short enough to sit in a phone's head row.
 *
 * The counts and the reasons are in the tooltip, where they can be as long as
 * they need to be. A chip that pushes the other buttons off the screen is a chip
 * nobody reads.
 */
export function chipLine(world: WorldSnapshot | null): string {
  if (!world) return "◉ World not read";
  const ok = world.sources.filter((source) => source.ok).length;
  const at = clock(world.builtAt);
  const tone = worldTone(world);
  if (tone === "live") return `◉ Synced ${at}`;
  if (tone === "partial") return `◉ Partial ${ok}/${world.sources.length} · ${at}`;
  return `◉ Stale · built ${at}`;
}

/** One sentence per source, for a tooltip: what answered, and what did not. */
export function describeSources(world: WorldSnapshot | null): string {
  if (!world) return "No snapshot: the space is the build.";
  return world.sources
    .map((source) => `${source.label}: ${source.ok ? source.note || "ok" : `no — ${source.note || "did not answer"}`}`)
    .join("\n");
}

/**
 * Ask the server for the world.
 *
 * A failed request is not an empty world: it says why, and the caller keeps what
 * it already had. `fresh=1` bypasses the server's cache, which is what the Sync
 * button is for.
 */
export async function loadWorld(
  options: { signal?: AbortSignal; fresh?: boolean } = {}
): Promise<{ ok: true; world: WorldSnapshot } | { ok: false; reason: string }> {
  try {
    const response = await fetch(`/api/world${options.fresh ? "?fresh=1" : ""}`, {
      method: "GET",
      headers: { accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const body = (await response.json().catch(() => null)) as unknown;
    const world = readWorld(body);
    if (world) return { ok: true, world };
    const reason = isRecord(body) && typeof body.error === "string" ? body.error : `${response.status} from /api/world`;
    return { ok: false, reason };
  } catch (problem) {
    if (problem instanceof DOMException && problem.name === "AbortError") return { ok: false, reason: "aborted" };
    return { ok: false, reason: problem instanceof Error ? problem.message : String(problem) };
  }
}

/** How often the space asks again. Sixty seconds: fast enough to feel alive,
 *  slow enough that a phone in a pocket is not polling Anything all afternoon. */
export const WORLD_POLL_MS = 60_000;
