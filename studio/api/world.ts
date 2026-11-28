import type { IncomingMessage, ServerResponse } from "node:http";
import { buildAtlas } from "../src/atlas.js";
import { readApps, worldVersion, type WorldDeployment, type WorldSource } from "../src/world.js";

/**
 * The world: one snapshot of everything the space is made of.
 *
 * The browser used to build the Atlas from committed data, which made the space
 * a picture of the repository rather than a view of the work. This endpoint is
 * the server's reading — the inventory, the apps, the deployments — answered as
 * one versioned document so a poll can tell whether anything changed.
 *
 * Three rules it keeps:
 *
 *  - **No key reaches the browser.** Anything's key and Vercel's token are read
 *    here and used here; the answer carries the *result*, never the credential.
 *  - **A source that did not answer is named.** An empty answer and a refused
 *    one are different sentences, and the HUD shows which is which.
 *  - **Polling is cheap.** Sixty seconds of cache, and an ETag that is the
 *    content's own version, so a refresh that finds nothing new costs a 304.
 */

const CACHE_MS = 60_000;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

type Cache = { at: number; world: WorldSnapshot };

interface WorldSnapshot {
  version: string;
  builtAt: number;
  sources: WorldSource[];
  apps: ReturnType<typeof readApps>;
  deployments: WorldDeployment[];
  counts: { nodes: number; edges: number; districts: number; apps: number; deployments: number };
}

/** One instance's memory: a warm function answers from it, a cold one rebuilds. */
let cache: Cache | null = null;

const origin = (req: IncomingMessage): string => {
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
};

const readJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (text.length > MAX_BYTES) return null;
    const body = JSON.parse(text || "null") as unknown;
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
    return body;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * The Anything projects, through this deployment's own bridge.
 *
 * The bridge is where the key lives and where every wrong-key diagnosis already
 * lives; calling it rather than re-implementing it means one place to fix when
 * Anything changes its mind. The detail calls are deliberately not made here:
 * the space can show an app as a sun without opening all of its screens, and
 * eight of them is eight round trips on every cold start.
 */
const readAnything = async (req: IncomingMessage): Promise<{ source: WorldSource; apps: WorldSnapshot["apps"] }> => {
  const at = Date.now();
  const base = origin(req);
  const label = "Anything";
  if (!base) {
    return { source: { id: "anything", label, ok: false, at: 0, note: "no origin to call the bridge on" }, apps: [] };
  }
  try {
    const body = await readJson(`${base}/api/anything`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/v0/api/projects?limit=100" }),
    });
    const projects = Array.isArray((body as { projects?: unknown })?.projects)
      ? ((body as { projects: unknown[] }).projects as Record<string, unknown>[])
      : Array.isArray(body)
        ? (body as Record<string, unknown>[])
        : [];
    const apps = readApps(
      projects.slice(0, 40).map((project) => ({
        id: typeof project.id === "string" ? project.id : undefined,
        name: project.name ?? project.title ?? project.slug,
        organizationName: (project.organization as { name?: string } | undefined)?.name ?? project.organizationName,
        platform: project.platform ?? "web",
        modules: Array.isArray(project.modules) ? project.modules : [],
        url: (project.latestPublishedUrl as string | undefined) ?? (project.publishedUrls as string[] | undefined)?.[0],
        updatedAt: project.updatedAt,
      }))
    );
    return {
      source: {
        id: "anything",
        label,
        ok: true,
        at,
        note: apps.length ? `${apps.length} project${apps.length === 1 ? "" : "s"}` : "answered, no projects",
        count: apps.length,
      },
      apps,
    };
  } catch (problem) {
    return {
      source: {
        id: "anything",
        label,
        ok: false,
        at: 0,
        note: problem instanceof Error ? problem.message.slice(0, 160) : "did not answer",
      },
      apps: [],
    };
  }
};

/**
 * The last deployments, if this project is allowed to ask.
 *
 * Without `VERCEL_TOKEN` the answer is a sentence, not a silence: the space then
 * says it has no deployments rather than implying there are none.
 */
const readVercel = async (): Promise<{ source: WorldSource; deployments: WorldDeployment[] }> => {
  const at = Date.now();
  const label = "Vercel";
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      source: { id: "vercel", label, ok: false, at: 0, note: "no VERCEL_TOKEN on this project — deployments are not read" },
      deployments: [],
    };
  }
  const team = process.env.VERCEL_TEAM_ID;
  const url = `https://api.vercel.com/v6/deployments?limit=6&target=production${team ? `&teamId=${encodeURIComponent(team)}` : ""}`;
  try {
    const body = await readJson(url, { headers: { Authorization: `Bearer ${token}` } });
    const list = Array.isArray((body as { deployments?: unknown })?.deployments)
      ? ((body as { deployments: Record<string, unknown>[] }).deployments as Record<string, unknown>[])
      : [];
    const deployments: WorldDeployment[] = list.map((entry) => {
      const meta = (entry.meta ?? {}) as Record<string, unknown>;
      return {
        name: typeof entry.name === "string" ? entry.name : "studio",
        url: typeof entry.url === "string" ? entry.url : "",
        state: typeof entry.state === "string" ? entry.state : String(entry.readyState ?? "unknown"),
        commit: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha.slice(0, 7) : null,
        at: typeof entry.created === "number" ? entry.created : 0,
      };
    });
    return {
      source: {
        id: "vercel",
        label,
        ok: true,
        at,
        note: deployments.length ? `${deployments.length} production deployments` : "answered, none production",
        count: deployments.length,
      },
      deployments,
    };
  } catch (problem) {
    return {
      source: {
        id: "vercel",
        label,
        ok: false,
        at: 0,
        note: problem instanceof Error ? problem.message.slice(0, 160) : "did not answer",
      },
      deployments: [],
    };
  }
};

const build = async (req: IncomingMessage): Promise<WorldSnapshot> => {
  const builtAt = Date.now();
  /* The Studio's own inventory cannot fail: it is compiled in. That is why it is
     the one source the HUD can always trust. */
  const base = buildAtlas();
  const sites = base.nodes.filter((node) => node.kind === "site");
  const [anything, vercel] = await Promise.all([readAnything(req), readVercel()]);

  const sources: WorldSource[] = [
    {
      id: "studio",
      label: "Studio",
      ok: true,
      at: builtAt,
      note: `${base.nodes.length} stars, ${base.districts.length} districts`,
      count: base.nodes.length,
    },
    {
      id: "sites",
      label: "Sites",
      ok: true,
      at: builtAt,
      note: `${sites.length} sites, ${sites.reduce((sum, site) => sum + (site.pages?.length ?? 0), 0)} pages`,
      count: sites.length,
    },
    {
      id: "github",
      label: "GitHub",
      ok: Boolean(process.env.GITHUB_TOKEN),
      at: process.env.GITHUB_TOKEN ? builtAt : 0,
      note: process.env.GITHUB_TOKEN ? "token set — the proxy is on" : "no GITHUB_TOKEN — the gate asks for one",
    },
    anything.source,
    vercel.source,
  ];

  const atlas = buildAtlas([], anything.apps);
  const version = worldVersion({ nodes: atlas.nodes, apps: anything.apps, deployments: vercel.deployments });

  return {
    version,
    builtAt,
    sources,
    apps: anything.apps,
    deployments: vercel.deployments,
    counts: {
      nodes: atlas.nodes.length,
      edges: atlas.edges.length,
      districts: atlas.districts.length,
      apps: anything.apps.length,
      deployments: vercel.deployments.length,
    },
  };
};

/** Exported for the tests: a warm cache is the point in production and a trap in a test. */
export function clearWorldCache() {
  cache = null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { ok: false, error: "GET only: the world is read, never written." });
      return;
    }
    const fresh = (req.url ?? "").includes("fresh=1");
    if (cache && !fresh && Date.now() - cache.at < CACHE_MS) {
      res.setHeader("ETag", `"${cache.world.version}"`);
      res.setHeader("X-World-Cache", "hit");
      json(res, 200, { ok: true, world: cache.world });
      return;
    }
    const world = await build(req);
    cache = { at: Date.now(), world };
    res.setHeader("ETag", `"${world.version}"`);
    res.setHeader("X-World-Cache", "miss");
    json(res, 200, { ok: true, world });
  } catch (problem) {
    if (res.headersSent) return;
    json(res, 500, {
      ok: false,
      error: `The world snapshot itself failed: ${problem instanceof Error ? problem.message : String(problem)}`,
    });
  }
}
