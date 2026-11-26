/**
 * Reads every Anything project, and every part inside it, at build time.
 *
 *   npm run scan:anything
 *
 * The key is only ever on the server, so a browser cannot scan the account. This
 * runs where the key already is — the build — and writes what it read to
 * `src/anythingScan.json`, which the Atlas and the City import. Two consequences
 * worth stating: the spaces are full before the first request is made, and every
 * visitor sees the same inventory even if the API is down when they arrive.
 *
 * It never fails the build. A missing key, a dead API or a slow project becomes
 * `{ ok: false, reason }` in the file, and the spaces say so rather than showing
 * an empty room with no explanation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANYTHING_API, ME_PATH, PROJECTS_PATH, PROJECT_PREFIX, authHeaders, keyCandidates } from "../src/anything";

/** Where the API lives. Overridable so the scan can be proved against a local mock. */
const BASE = (process.env.ANYTHING_BASE || ANYTHING_API).replace(/\/$/, "");
const TIMEOUT_MS = 12_000;
const MAX_PROJECTS = 24;
/** A build that waits minutes for a third party's API is a build that fails the deploy. */
const BUDGET_MS = 45_000;
const MAX_PARTS = 400;

export interface ScannedApp {
  id: string;
  name: string;
  organizationName: string;
  platform: string;
  modules: string[];
  moduleCount: number;
  url?: string;
  updatedAt: string;
}

export interface Scan {
  /** When the build read the account. */
  scannedAt: string;
  ok: boolean;
  /** Why it could not be read, in the words the space will show. */
  reason?: string;
  apps: ScannedApp[];
  counts: { projects: number; parts: number; unread: number };
  me?: { name: string; email: string; credits: number | null } | null;
}

const text = (value: unknown, limit = 160): string =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

const httpsOnly = (value: unknown): string | undefined => {
  const raw = text(value, 400);
  return /^https:\/\/[^\s]+$/i.test(raw) ? raw : undefined;
};

const get = async (key: string, route: string): Promise<unknown> => {
  const response = await fetch(`${BASE}${route}`, {
    headers: { Accept: "application/json", ...authHeaders(key) },
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`.trim());
  }
  return response.json();
};

/** A project plus its detail, flattened to exactly what the spaces draw. */
export function toScannedApp(project: Record<string, unknown>, info: Record<string, unknown> | null): ScannedApp {
  const files = Array.isArray(info?.files) ? (info.files as Record<string, unknown>[]) : [];
  const names = files.map((file) => text(file?.name, 60)).filter(Boolean);
  const platform = info?.platform === "mobile" || info?.platform === "both" ? String(info.platform) : "web";
  const url = httpsOnly(info?.latestPublishedUrl) ?? httpsOnly((info?.publishedUrls as unknown[] | undefined)?.[0]);
  return {
    id: text(project.id, 64),
    name: text(project.name, 80),
    organizationName: text(project.organizationName, 80) || "Anything",
    platform,
    modules: names.slice(0, MAX_PARTS),
    moduleCount: names.length,
    ...(url ? { url } : {}),
    updatedAt: text(project.updatedAt, 40),
  };
}

export async function scanAnything(env: Record<string, string | undefined> = process.env): Promise<Scan> {
  const scannedAt = new Date().toISOString();
  const empty = (reason: string): Scan => ({ scannedAt, ok: false, reason, apps: [], counts: { projects: 0, parts: 0, unread: 0 } });
  const key = keyCandidates(env)[0];
  if (!key) return empty("No Anything key was set for this build, so nothing could be read.");

  let projects: Record<string, unknown>[];
  try {
    const list = (await get(key.value, `${PROJECTS_PATH}?limit=100`)) as { projects?: unknown };
    projects = Array.isArray(list?.projects) ? (list.projects as Record<string, unknown>[]) : [];
  } catch (problem) {
    return empty(`Anything could not be listed at build time: ${problem instanceof Error ? problem.message : "no answer"}.`);
  }
  if (!projects.length) return empty("Anything has no projects on this account.");

  const me = await get(key.value, ME_PATH)
    .then((raw) => {
      const record = raw as Record<string, unknown>;
      const organization = Array.isArray(record?.organizations) ? (record.organizations[0] as Record<string, unknown>) : null;
      return {
        name: text(record?.name, 80) || text(record?.email, 80) || "you",
        email: text(record?.email, 120),
        credits: typeof organization?.creditsBalance === "number" ? (organization.creditsBalance as number) : null,
      };
    })
    .catch(() => null);

  const chosen = projects.slice(0, MAX_PROJECTS);
  const deadline = Date.now() + BUDGET_MS;
  const details = await Promise.allSettled(
    chosen.map((project) =>
      Date.now() > deadline
        ? Promise.reject(new Error("the scan ran out of time"))
        : get(key.value, `${PROJECT_PREFIX}${encodeURIComponent(text(project.id, 64))}`)
    )
  );
  const apps = chosen
    .map((project, index) => {
      const result = details[index];
      return toScannedApp(project, result?.status === "fulfilled" ? (result.value as Record<string, unknown>) : null);
    })
    .filter((app) => app.id && app.name);

  const unread = details.filter((result) => result.status === "rejected").length;
  const parts = apps.reduce((total, app) => total + app.moduleCount, 0);
  return {
    scannedAt,
    ok: true,
    apps,
    counts: { projects: apps.length, parts, unread },
    me,
  };
}

/* Run only when invoked as a script, so a test can import the two functions. */
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const target = path.resolve("src/generated/anythingScan.json");
  let scan: Scan;
  try {
    scan = await scanAnything();
  } catch (problem) {
    scan = {
      scannedAt: new Date().toISOString(),
      ok: false,
      reason: `The scan failed: ${problem instanceof Error ? problem.message : "unknown reason"}.`,
      apps: [],
      counts: { projects: 0, parts: 0, unread: 0 },
    };
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(scan, null, 2)}\n`, "utf8");
  console.log(
    scan.ok
      ? `scan:anything — ${scan.counts.projects} projects, ${scan.counts.parts} parts${scan.counts.unread ? `, ${scan.counts.unread} unread` : ""} → src/generated/anythingScan.json`
      : `scan:anything — nothing read (${scan.reason}) → src/generated/anythingScan.json`
  );
}
