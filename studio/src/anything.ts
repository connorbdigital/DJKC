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
 * Two paths, exact. A proxy that forwards "anything under /v0/api/" is a proxy
 * that will one day forward a delete, so the list is closed.
 */
export function anythingTarget(rawPath: unknown): AnythingTarget {
  if (typeof rawPath !== "string" || rawPath.length === 0) return { ok: false, reason: "Send a path, e.g. /v0/api/projects." };
  if (rawPath.length > 300) return { ok: false, reason: "That path is too long." };
  if (rawPath.includes("..") || rawPath.includes("\\") || rawPath.includes("@") || rawPath.includes("//")) {
    return { ok: false, reason: "That path is not forwarded." };
  }
  if (!rawPath.startsWith("/")) return { ok: false, reason: "A path must start with /." };
  const [path, query] = rawPath.split("?", 2) as [string, string | undefined];
  if (path !== ME_PATH && path !== PROJECTS_PATH) {
    return { ok: false, reason: `Only ${ME_PATH} and ${PROJECTS_PATH} are forwarded.` };
  }
  return { ok: true, url: `${ANYTHING_API}${path}${query ? `?${query}` : ""}` };
}

/** Anything's auth: key as username, empty password. */
export function basicAuth(key: string): string {
  return `Basic ${btoa(`${key}:`)}`;
}
