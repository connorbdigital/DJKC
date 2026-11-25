/**
 * The one place the browser asks for Anything data.
 *
 * Every call goes through this deployment's `/api/anything`, so no key is in the
 * page; every shape that comes back is treated as untrusted, because it crossed
 * a network and a third party's release schedule to get here.
 */
import {
  ME_PATH,
  PROJECTS_PATH,
  PROJECT_PREFIX,
  type AnythingMe,
  type AnythingProject,
  type AnythingProjectInfo,
} from "./anything";

/** What the Atlas and the tab both want: one app, flattened. */
export interface AnythingApp {
  id: string;
  name: string;
  organizationName: string;
  /** web, mobile, or both. */
  platform: string;
  /** Module names — the screens and functions inside the app. */
  modules: string[];
  /** The live URL, if it has ever been published. */
  url?: string;
  updatedAt: string;
}

/** A project's detail that could not be read is not a project that does not exist. */
export type AnythingLoad =
  | { ok: true; apps: AnythingApp[]; me: AnythingMe | null }
  | { ok: false; reason: string };

const POST = async (path: string, signal?: AbortSignal) => {
  const response = await fetch("/api/anything", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    ...(signal ? { signal } : {}),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const reason = typeof body?.error === "string" ? body.error : `${response.status} ${response.statusText}`;
    throw new Error(reason);
  }
  return body ?? {};
};

const text = (value: unknown, limit = 160): string =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

const httpsOnly = (value: unknown): string | undefined => {
  const raw = text(value, 400);
  return /^https:\/\/[^\s]+$/i.test(raw) ? raw : undefined;
};

/** The list endpoint's shape, made safe. */
export function parseProjects(raw: unknown): AnythingProject[] {
  const list = (raw as { projects?: unknown } | null)?.projects;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: AnythingProject[] = [];
  for (const entry of list.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = text(record.id, 64);
    const name = text(record.name, 80);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      slug: typeof record.slug === "string" ? text(record.slug, 80) : null,
      organizationId: text(record.organizationId, 64),
      organizationName: text(record.organizationName, 80) || "Anything",
      createdAt: text(record.createdAt, 40),
      updatedAt: text(record.updatedAt, 40),
    });
  }
  return out;
}

/** One project's detail, made safe: unknown platforms collapse to "web". */
export function toApp(project: AnythingProject, info: AnythingProjectInfo | null): AnythingApp {
  const platform = info?.platform === "mobile" || info?.platform === "both" ? info.platform : "web";
  const modules = Array.isArray(info?.files)
    ? info.files
        .map((file) => text(file?.name, 60))
        .filter(Boolean)
        .slice(0, 24)
    : [];
  const url = httpsOnly(info?.latestPublishedUrl) ?? httpsOnly(info?.publishedUrls?.[0]);
  return {
    id: project.id,
    name: project.name,
    organizationName: project.organizationName,
    platform,
    modules,
    ...(url ? { url } : {}),
    updatedAt: project.updatedAt,
  };
}

/**
 * Who you are, which projects you have, and what is inside each one.
 *
 * The list failing is the only fatal case; a detail that fails to load leaves an
 * app with its name and no modules, which is still worth putting in the space.
 */
export async function loadAnythingApps(options: { limit?: number; signal?: AbortSignal } = {}): Promise<AnythingLoad> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 24);
  let projects: AnythingProject[];
  try {
    projects = parseProjects(await POST(`${PROJECTS_PATH}?limit=100`, options.signal));
  } catch (problem) {
    return { ok: false, reason: problem instanceof Error ? problem.message : "Anything did not answer." };
  }

  const me = await POST(ME_PATH, options.signal)
    .then((raw) => raw as unknown as AnythingMe)
    .catch(() => null);

  const chosen = projects.slice(0, limit);
  const details = await Promise.allSettled(
    chosen.map(async (project) => {
      const raw = await POST(`${PROJECT_PREFIX}${encodeURIComponent(project.id)}`, options.signal);
      return raw as unknown as AnythingProjectInfo;
    })
  );
  const apps = chosen.map((project, index) => {
    const result = details[index];
    return toApp(project, result?.status === "fulfilled" ? result.value : null);
  });
  return { ok: true, apps, me };
}
