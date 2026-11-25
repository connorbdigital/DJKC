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

/**
 * The schemes worth trying. Anything documents Basic, and Basic is tried first
 * and stays first: a working Basic key never pays for the experiment. The other
 * two exist because a refused key of the right shape leaves only two answers —
 * the key is dead, or the API is reading a header we are not sending — and the
 * second is cheap to rule out from inside the bridge.
 */
export const ANYTHING_AUTH_SCHEMES = ["basic", "bearer", "x-api-key"] as const;
export type AuthScheme = (typeof ANYTHING_AUTH_SCHEMES)[number];

export function authHeaders(rawKey: string, scheme: AuthScheme = "basic"): Record<string, string> {
  const key = cleanKey(rawKey);
  if (scheme === "bearer") return { Authorization: `Bearer ${key}` };
  if (scheme === "x-api-key") return { "X-API-Key": key };
  return { Authorization: basicAuth(key) };
}

/**
 * A key pasted into a dashboard usually arrives with something attached: a
 * newline from the clipboard, quotes from a chat message, a leading space from a
 * double-click. Anything then answers 401 and the key looks fine, which is the
 * worst kind of wrong. Trim, and take one layer of quotes off.
 */
export function cleanKey(raw: string): string {
  const value = raw.trim().replace(/^["'`]|["'`]$/g, "").trim();
  return (
    value
      /* A key pasted from a wrapped line arrives with a space in the middle. */
      .replace(/\s+/g, "")
      /* Invisible characters a rich-text copy leaves behind: no-break space,
         zero-width space/joiner, word joiner, byte-order mark. They survive
         every visible check and turn a correct key into a 401. */
      .replace(/[\u00A0\u200B-\u200D\u2060\uFEFF]/g, "")
      /* Anything's docs print the example as `anything_xxx:` because Basic auth
         adds the colon. Pasting it with the colon sends two, and 401s. */
      .replace(/:+$/, "")
  );
}

export interface KeyCandidate {
  /** The environment variable's name — never the key itself. */
  name: string;
  value: string;
}

/**
 * A variable name with its case and punctuation thrown away, so the three
 * spellings people actually type are one name: `ANYTHING_API_KEY`,
 * `Anything_Key`, `anything_api_key`, and `anything-api-key` too.
 *
 * Vercel is case-sensitive, and a key that is present, correct and spelled
 * `anything_api_key` used to read as "no key set" — the worst outcome, because
 * the message then tells you to add the thing you already added.
 */
export const normaliseKeyName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Any variable whose name normalises to one of these is taken as the key. */
export const KEY_NAMES = ["anythingapikey", "anythingkey"] as const;

/** Every configured key, the documented spellings first, duplicates dropped. */
export function keyCandidates(env: Record<string, string | undefined> = {}): KeyCandidate[] {
  const rank = (name: string) => {
    const index = (ANYTHING_KEYS as readonly string[]).indexOf(name);
    return index === -1 ? ANYTHING_KEYS.length : index;
  };
  const names = Object.keys(env)
    .filter((name) => (KEY_NAMES as readonly string[]).includes(normaliseKeyName(name)))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const seen = new Set<string>();
  const found: KeyCandidate[] = [];
  for (const name of names) {
    const raw = env[name];
    if (!raw) continue;
    const value = cleanKey(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    found.push({ name, value });
  }
  return found;
}

/** What can be said about a key without saying the key. */
export function keyShape(raw: string): {
  length: number;
  anythingPrefix: boolean;
  hadWhitespace: boolean;
  hadQuotes: boolean;
  hadColon: boolean;
  looksLikeJwt: boolean;
  plainCharacters: boolean;
  outsideCharacters: number;
  looksLikeExample: boolean;
} {
  const value = cleanKey(raw);
  const allowed = /^[A-Za-z0-9_-]*$/;
  return {
    length: value.length,
    anythingPrefix: /^anything_/.test(value),
    hadWhitespace: raw !== raw.trim() || /\s/.test(raw.trim()),
    hadQuotes: /^["'`]|["'`]$/.test(raw.trim()),
    hadColon: /:*$/.test(raw),
    looksLikeJwt: value.split(".").length === 3 && value.length > 80,
    /* Anything's keys are ASCII: letters, digits, underscore, dash. Anything else
       in the value is a paste artefact or a different product's token. */
    plainCharacters: allowed.test(value),
    outsideCharacters: [...value].filter((character) => !/[A-Za-z0-9_-]/.test(character)).length,
    /* The docs print `anything_xxx:` as an example. It is a shape, not a key,
       and it is the single most likely thing in a variable that was never
       filled in properly. */
    looksLikeExample: /^anything_x{2,}$/i.test(value) || /^(your|example|placeholder|test)/i.test(value),
  };
}

/** One sentence about a key's shape, for a 401 that has to be actionable. */
export function keyDiagnosis(name: string, raw: string): string {
  const shape = keyShape(raw);
  const notes: string[] = [`${name} is ${shape.length} characters`];
  if (!shape.anythingPrefix) notes.push("it does not start with anything_");
  if (shape.hadWhitespace) notes.push("it had a space or newline in it, which is now stripped");
  if (shape.hadQuotes) notes.push("it arrived inside quotes, which are now stripped");
  if (shape.hadColon) notes.push("it ended with a colon — the one Basic auth adds — which is now stripped");
  if (shape.looksLikeJwt) notes.push("it looks like a signed token, not an API key");
  if (!shape.plainCharacters) notes.push(`it holds ${shape.outsideCharacters} character(s) that are not letters, digits, underscore or dash`);
  if (shape.looksLikeExample) notes.push("it is the example from Anything's own documentation, not a key");
  return notes.join("; ");
}
