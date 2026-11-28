/**
 * The one place the browser asks for Anything data.
 *
 * Every call goes through this deployment's `/api/anything`, so no key is in the
 * page; every shape that comes back is treated as untrusted, because it crossed
 * a network and a third party's release schedule to get here.
 */
import { APEX_AUDIT_BRIEF } from "./anythingAudit";
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
  /** Module names — every screen, component and function inside the app. */
  modules: string[];
  /** How many the project reports, so a capped list can still be honest. */
  moduleCount?: number;
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
    /* A JSON error is ours and says something useful. An HTML or empty body at
       a 5xx means the function crashed before it could speak: say that, rather
       than passing on a status code with no meaning to anyone reading it. */
    const reason =
      typeof body?.error === "string"
        ? body.error
        : response.status >= 500
          ? `the Anything bridge answered ${response.status} without a message — the function itself failed`
          : `${response.status} ${response.statusText}`.trim();
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
  /* Every module, not the first screenful: the spaces are a map of what is
     inside an app, and a map that stops at 24 lies about the shape of it. The
     400 is a guard against a pathological response, not a display choice. */
  const names = Array.isArray(info?.files)
    ? info.files.map((file) => text(file?.name, 60)).filter(Boolean)
    : [];
  const modules = names.slice(0, 400);
  const url = httpsOnly(info?.latestPublishedUrl) ?? httpsOnly(info?.publishedUrls?.[0]);
  return {
    id: project.id,
    name: project.name,
    organizationName: project.organizationName,
    platform,
    modules,
    moduleCount: names.length,
    ...(url ? { url } : {}),
    updatedAt: project.updatedAt,
  };
}

export type AnythingList =
  | { ok: true; projects: AnythingProject[]; me: AnythingMe | null }
  | { ok: false; reason: string };

/**
 * Every project the key can open — the list on its own, no details.
 *
 * The detail call is what says what is *inside* a project, and it is one request
 * per project: doing that for a hundred projects before drawing a list is how a
 * tab takes a minute to appear. So the list comes first, and the contents are
 * read when somebody asks for them.
 */
export async function loadAnythingList(options: { signal?: AbortSignal } = {}): Promise<AnythingList> {
  let projects: AnythingProject[];
  try {
    projects = parseProjects(await POST(`${PROJECTS_PATH}?limit=100`, options.signal));
  } catch (problem) {
    return { ok: false, reason: problem instanceof Error ? problem.message : "Anything did not answer." };
  }
  const me = await POST(ME_PATH, options.signal)
    .then((raw) => raw as unknown as AnythingMe)
    .catch(() => null);
  return { ok: true, projects, me };
}

/** One project's contents, asked for on demand. */
export async function loadAnythingProject(
  project: AnythingProject,
  signal?: AbortSignal
): Promise<{ ok: true; app: AnythingApp } | { ok: false; reason: string }> {
  try {
    const raw = await POST(`${PROJECT_PREFIX}${encodeURIComponent(project.id)}`, signal);
    return { ok: true, app: toApp(project, raw as unknown as AnythingProjectInfo) };
  } catch (problem) {
    return { ok: false, reason: problem instanceof Error ? problem.message : "That project could not be read." };
  }
}

/**
 * Who you are, which projects you have, and what is inside each one.
 *
 * The list failing is the only fatal case; a detail that fails to load leaves an
 * app with its name and no modules, which is still worth putting in the space.
 */
export async function loadAnythingApps(options: { limit?: number; signal?: AbortSignal } = {}): Promise<AnythingLoad> {
  /* Twenty-four detail calls is already a slow first paint; forty is the cap for
     an account with more apps than that, and the rest are still listed by name. */
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 40);
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

/**
 * The one write: send a brief to a project and start a revision.
 *
 * The prompt defaults to the SiteBuildup audit brief because that is what this
 * Studio has an opinion about; anything else can be passed in. The response is
 * Anything's own — a revision id and a thread — and it is treated like every
 * other shape that crossed the network: checked, and only then believed.
 */
export interface BriefSent {
  revisionId: string;
  threadId: string | null;
}

export async function sendBrief(
  projectId: string,
  prompt: string = APEX_AUDIT_BRIEF.prompt
): Promise<{ ok: true; sent: BriefSent } | { ok: false; reason: string }> {
  try {
    const response = await fetch("/api/anything", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generate: { projectId, prompt } }),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const said = typeof body?.error === "string" ? body.error : `${response.status} ${response.statusText}`.trim();
      return { ok: false, reason: said };
    }
    const revisionId = typeof body?.revisionId === "string" ? body.revisionId : "";
    const threadId = typeof body?.threadId === "string" ? body.threadId : null;
    if (!revisionId) {
      return { ok: false, reason: "Anything accepted the brief but sent back no revision id, so there is nothing to follow. Check the project on anything.com before sending again." };
    }
    return { ok: true, sent: { revisionId, threadId } };
  } catch (problem) {
    return { ok: false, reason: problem instanceof Error ? problem.message : "The brief could not be sent." };
  }
}
