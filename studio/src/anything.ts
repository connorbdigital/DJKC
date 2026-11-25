/**
 * Anything (anything.com) speaks HTTP Basic: the API key is the *username* and
 * the password is empty. Two read endpoints are all this needs — who you are and
 * which projects you can open — so those are the only two the proxy forwards.
 *
 * Docs: https://www.anything.com/docs/api-reference/projects/list-accessible-projects
 */

export const ANYTHING_API = "https://api.anything.com";
export const ME_PATH = "/v0/api/me";
export const PROJECTS_PATH = "/v0/api/projects";
export const PROJECT_PREFIX = "/v0/api/projects/";

/** The variable this looks for first, then the name the key was first saved under. */
export const ANYTHING_KEYS = ["ANYTHING_API_KEY", "Anything_Key"] as const;

export interface AnythingProject {
  id: string;
  name: string;
  slug: string | null;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}

/** One module inside a project: a screen, a page, a function. */
export interface AnythingModule {
  id: string;
  name: string;
  moduleType: string;
  path: string | null;
}

/** `GET /v0/api/projects/{id}` — what is actually inside one app. */
export interface AnythingProjectInfo {
  id: string;
  name: string;
  slug: string | null;
  platform: "web" | "mobile" | "both";
  createdAt: string;
  updatedAt: string;
  devServerUrl: string | null;
  mobilePreviewUrl: string | null;
  publishedUrls: string[];
  latestPublishedUrl: string | null;
  files: AnythingModule[];
}

export interface AnythingOrganization {
  id: string;
  name: string;
  plan: string;
  planDisplayName: string;
  isPaid: boolean;
  creditsBalance: number;
}

export interface AnythingMe {
  id: string;
  email: string | null;
  name: string | null;
  organizations: AnythingOrganization[];
}

export type AnythingTarget = { ok: true; url: string } | { ok: false; reason: string };

/**
 * A project id, and nothing else: the dashboard's `prj_…` form or a uuid.
 * Deliberately narrower than "one path segment" — `/v0/api/projects/delete` is a
 * segment, and the proxy has no business forwarding a word that reads like a verb.
 */
const PROJECT_ID =
  /^(?:prj_[A-Za-z0-9_-]{1,60}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const SAFE_QUERY = /^[A-Za-z0-9=&%._-]*$/;

/**
 * Three paths, exact: who you are, the list, and one project's own detail.
 * A proxy that forwards "anything under /v0/api/" is a proxy that will one day
 * forward a delete, so the list is closed — and the detail path takes one id
 * segment, never a nested path, so it cannot reach rename or delete.
 */
export function anythingTarget(rawPath: unknown): AnythingTarget {
  if (typeof rawPath !== "string" || rawPath.length === 0) return { ok: false, reason: "Send a path, e.g. /v0/api/projects." };
  if (rawPath.length > 300) return { ok: false, reason: "That path is too long." };
  if (rawPath.includes("..") || rawPath.includes("\\") || rawPath.includes("@") || rawPath.includes("//")) {
    return { ok: false, reason: "That path is not forwarded." };
  }
  if (!rawPath.startsWith("/")) return { ok: false, reason: "A path must start with /." };
  const [path, query] = rawPath.split("?", 2) as [string, string | undefined];
  if (query !== undefined && !SAFE_QUERY.test(query)) return { ok: false, reason: "That query is not forwarded." };
  const detail = path.startsWith(PROJECT_PREFIX) ? path.slice(PROJECT_PREFIX.length) : null;
  const known = path === ME_PATH || path === PROJECTS_PATH || (detail !== null && PROJECT_ID.test(detail));
  if (!known) {
    return { ok: false, reason: `Only ${ME_PATH}, ${PROJECTS_PATH} and one project's detail are forwarded.` };
  }
  return { ok: true, url: `${ANYTHING_API}${path}${query ? `?${query}` : ""}` };
}

/** Anything's auth: key as username, empty password. */
export function basicAuth(key: string): string {
  return `Basic ${btoa(`${key}:`)}`;
}
