import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ANYTHING_KEYS,
  ME_PATH,
  PROJECTS_PATH,
  PROJECT_PREFIX,
  GENERATE_SUFFIX,
  generateTarget,
  ANYTHING_AUTH_SCHEMES,
  anythingTarget,
  authHeaders,
  keyCandidates,
  type AuthScheme,
  keyDiagnosis,
  keyShape,
  type KeyCandidate,
} from "../src/anything.js";

/**
 * Lists the Anything projects this account can open — and will start a build in
 * one of them — without the key ever reaching the browser.
 *
 * Reads are the two documented paths plus one project's detail. The single write
 * is `POST /v0/api/projects/{id}/generate`, and it is deliberately one call with
 * one shape: a project id and a prompt. Anything's delete and rename live under
 * the same prefix, so the write is a separate rule with its own validation rather
 * than a flag on the read path.
 *
 * Auth is Anything's own — the key as Basic username, empty password — and it is
 * added here, never returned.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

/**
 * Every configured key, canonical name first. Two variables holding different
 * keys is the common way a 401 happens: the wrong one used to win silently, so
 * now each is tried in turn and the answer says which one Anything accepted.
 */
const keys = (): KeyCandidate[] => keyCandidates(process.env);

interface Attempt {
  path: string;
  status: number;
  detail: string;
}

/** The upstream's own words, short enough to sit in a sentence. */
const words = (raw: string): string => {
  const flat = raw.replace(/\s+/g, " ").trim();
  if (!flat) return "an empty body";
  try {
    const parsed = JSON.parse(flat) as { error?: unknown; message?: unknown };
    const said = [parsed.error, parsed.message].find((value) => typeof value === "string" && value.trim());
    if (typeof said === "string") return said.slice(0, 200);
  } catch {
    /* not JSON: the first line is still worth reading */
  }
  return flat.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
};

/** One GET with one scheme. No retries; the caller decides what a failure means. */
async function once(
  key: string,
  path: string,
  signal: AbortSignal,
  scheme: AuthScheme
): Promise<{ ok: true; status: number; text: string } | { ok: false; attempt: Attempt }> {
  const target = anythingTarget(path);
  if (!target.ok) return { ok: false, attempt: { path, status: 0, detail: target.reason } };
  try {
    const upstream = await fetch(target.url, {
      method: "GET",
      headers: { Accept: "application/json", ...authHeaders(key, scheme) },
      redirect: "error",
      signal,
    });
    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, attempt: { path, status: 502, detail: "the response is too large to pass through" } };
    }
    if (!upstream.ok) {
      return { ok: false, attempt: { path, status: upstream.status, detail: words(text) } };
    }
    return { ok: true, status: upstream.status, text };
  } catch (problem) {
    const detail =
      problem instanceof Error && problem.name === "AbortError"
        ? "it did not answer in time"
        : "api.anything.com could not be reached from here";
    return { ok: false, attempt: { path, status: 0, detail } };
  }
}

/**
 * Which scheme Anything accepts this key under. Basic is expected and is tried
 * first; the others are tried only after a 401, and only once per key per warm
 * instance, so a working deployment never pays for the experiment.
 *
 * Kept in module scope on purpose: it holds key material, and it must not leave
 * this process. Nothing reads it but the two functions below.
 */
const schemeCache = new Map<string, { scheme: AuthScheme; at: number }>();
const SCHEME_TTL = 10 * 60_000;

async function discover(key: string, signal: AbortSignal): Promise<AuthScheme | null> {
  const cached = schemeCache.get(key);
  if (cached && Date.now() - cached.at < SCHEME_TTL) return cached.scheme;
  for (const scheme of ANYTHING_AUTH_SCHEMES) {
    const answer = await once(key, ME_PATH, signal, scheme);
    if (answer.ok) {
      schemeCache.set(key, { scheme, at: Date.now() });
      return scheme;
    }
    /* Only a refusal moves on to the next scheme; 5xx or no answer means the
       API is unwell, not that the header is wrong. */
    if (answer.attempt.status !== 401) return null;
  }
  return null;
}

/**
 * One GET upstream, in the scheme this key is known to use. A 401 with no cached
 * scheme is the one case worth spending requests on: try the other headers
 * before reporting that the key is refused.
 */
async function read(
  key: string,
  path: string,
  signal: AbortSignal
): Promise<{ ok: true; status: number; text: string } | { ok: false; attempt: Attempt }> {
  const known = schemeCache.get(key);
  const first = known && Date.now() - known.at < SCHEME_TTL ? known.scheme : "basic";
  const answer = await once(key, path, signal, first);
  if (answer.ok || answer.attempt.status !== 401 || known) return answer;
  for (const scheme of ANYTHING_AUTH_SCHEMES) {
    if (scheme === first) continue;
    const alternative = await once(key, path, signal, scheme);
    if (alternative.ok) {
      schemeCache.set(key, { scheme, at: Date.now() });
      return alternative;
    }
    if (alternative.attempt.status !== 401) return alternative;
  }
  return answer;
}

/**
 * The list, tried the way the docs describe and then the way a broken endpoint
 * sometimes still answers: as asked, plain, then organization by organization.
 * A 500 from one shape is not proof that the account has no projects.
 */
async function listAttempts(key: string, asked: string, signal: AbortSignal) {
  const paths = [asked];
  if (asked !== PROJECTS_PATH) paths.push(PROJECTS_PATH);
  const first = await read(key, paths[0]!, signal);
  if (first.ok) return { ok: true as const, text: first.text, tried: [paths[0]!] };
  const attempts: Attempt[] = [first.attempt];
  if (paths[1]) {
    const plain = await read(key, paths[1], signal);
    if (plain.ok) return { ok: true as const, text: plain.text, tried: [paths[0]!, paths[1]] };
    attempts.push(plain.attempt);
  }
  /* Who the key belongs to, and which organizations it can see. */
  const me = await read(key, ME_PATH, signal);
  let email = "";
  let organizations: { id: string; name: string }[] = [];
  if (me.ok) {
    try {
      const parsed = JSON.parse(me.text) as { email?: string | null; organizations?: { id?: string; name?: string }[] };
      email = typeof parsed.email === "string" ? parsed.email : "";
      organizations = (parsed.organizations ?? [])
        .filter((org): org is { id: string; name: string } => typeof org?.id === "string" && typeof org?.name === "string")
        .slice(0, 3);
    } catch {
      /* the list is still worth a per-organization try even unparsed */
    }
  }
  for (const organization of organizations) {
    const path = `${PROJECTS_PATH}?organizationId=${encodeURIComponent(organization.id)}`;
    const attempt = await read(key, path, signal);
    if (attempt.ok) return { ok: true as const, text: attempt.text, tried: [...attempts.map((entry) => entry.path), path] };
    attempts.push(attempt.attempt);
  }
  return { ok: false as const, attempts, email, organizations: organizations.length };
}

/** One POST upstream: the whole of the bridge's write surface. */
async function send(
  key: string,
  target: { url: string; prompt: string },
  threadId: string | null,
  signal: AbortSignal,
  scheme: AuthScheme
): Promise<{ ok: true; status: number; text: string } | { ok: false; attempt: Attempt }> {
  try {
    const upstream = await fetch(target.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders(key, scheme),
      },
      /* A new thread unless one is named: continuing someone else's conversation
         by accident puts this brief in the middle of another job. */
      body: JSON.stringify(threadId ? { prompt: target.prompt, threadId } : { prompt: target.prompt, createNewThread: true }),
      redirect: "error",
      signal,
    });
    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, attempt: { path: target.url, status: 502, detail: "the response is too large to pass through" } };
    }
    if (!upstream.ok) return { ok: false, attempt: { path: target.url, status: upstream.status, detail: words(text) } };
    return { ok: true, status: upstream.status, text };
  } catch (problem) {
    const detail =
      problem instanceof Error && problem.name === "AbortError"
        ? "it did not answer in time"
        : "api.anything.com could not be reached from here";
    return { ok: false, attempt: { path: target.url, status: 0, detail } };
  }
}

/**
 * Start a revision from a prompt.
 *
 * Every stored key is tried, and within a key every scheme until one is accepted:
 * a write is the one call where "no answer" and "wrong header" look identical
 * from the outside, and a second attempt costs nothing compared with telling
 * someone their project failed when it did not.
 */
async function generate(raw: unknown, candidates: KeyCandidate[], res: ServerResponse): Promise<void> {
  const record = (raw ?? {}) as { projectId?: unknown; prompt?: unknown; threadId?: unknown };
  const target = generateTarget(record.projectId, record.prompt);
  if (!target.ok) {
    json(res, 400, { ok: false, error: target.reason });
    return;
  }
  const threadId =
    typeof record.threadId === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(record.threadId)
      ? record.threadId
      : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * Math.max(1, candidates.length));
  try {
    const rejected: Attempt[] = [];
    for (const candidate of candidates) {
      const known = schemeCache.get(candidate.value);
      const first: AuthScheme = known && Date.now() - known.at < SCHEME_TTL ? known.scheme : "basic";
      for (const scheme of [first, ...ANYTHING_AUTH_SCHEMES.filter((entry) => entry !== first)]) {
        const answer = await send(candidate.value, target, threadId, controller.signal, scheme);
        if (answer.ok) {
          schemeCache.set(candidate.value, { scheme, at: Date.now() });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Anything-Key", candidate.name);
          res.setHeader("X-Anything-Path", target.path);
          res.end(answer.text);
          return;
        }
        rejected.push({ ...answer.attempt, path: `${candidate.name} (${scheme}) → ${target.path}` });
        /* Only a refusal is worth another header; a 5xx or a timeout is the API. */
        if (answer.attempt.status !== 401) break;
      }
      if (!rejected.every((attempt) => attempt.status === 401)) break;
    }
    const last = rejected[rejected.length - 1]!;
    const unauthorised = rejected.every((attempt) => attempt.status === 401);
    json(res, unauthorised ? 401 : 502, {
      ok: false,
      status: last.status,
      attempts: rejected,
      error: unauthorised
        ? "Anything refused the stored key, so the brief was not sent. Open /api/anything?probe=1 for what the key itself answers, then replace it with a key from Anything → Settings → API keys."
        : `Anything answered ${last.status || "nothing"} on ${target.path}: ${last.detail}. The brief was not sent, and no revision was started.`,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  /* A GET is the bridge's own pulse: open /api/anything in a browser and the
     function answers about itself, with no key and no upstream call. When the
     Studio says "500" this is the page that says whether the function exists,
     whether it can see the key, and which Node it is running under. */
  if (req.method === "GET") {
    const configured = keys();
    const base = {
      ok: true as const,
      bridge: "alive",
      key: configured.length ? "set" : "missing",
      /* What is actually configured, not what the bridge looks for: the two were
         reported as one list, which read as though both names were set. */
      keyNames: configured.map((candidate) => candidate.name),
      keyNamesLookedFor: ANYTHING_KEYS,
      node: process.version,
      readOnly: false,
      forwards: [ME_PATH, PROJECTS_PATH, `${PROJECTS_PATH}/{id}`],
      writes: [`${PROJECT_PREFIX}{id}${GENERATE_SUFFIX}`],
    };

    /* ?probe=1 is the diagnostic: ask Anything about each stored key and report
       the answer, with lengths and shapes but never the key. Opening one URL in
       a browser then explains a 401, which is the only thing a status code was
       ever good for. */
    if (new URL(req.url ?? "/", "https://studio.invalid").searchParams.get("probe")) {
      if (!configured.length) {
        json(res, 200, { ...base, probe: { verdict: `No key is set. Add ${ANYTHING_KEYS[0]} to this project.`, keys: [] } });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const results = [];
        for (const candidate of configured) {
          const raw = process.env[candidate.name] ?? "";
          const shape = keyShape(raw);
          /* Every scheme, so the answer says which header Anything wants — and
             if one of the others works, the bridge has already remembered it. */
          const tried = [];
          let accepted: { scheme: AuthScheme; status: number } | null = null;
          for (const scheme of ANYTHING_AUTH_SCHEMES) {
            const answer = await once(candidate.value, ME_PATH, controller.signal, scheme);
            tried.push({ scheme, status: answer.ok ? answer.status : answer.attempt.status, detail: answer.ok ? "" : answer.attempt.detail });
            if (answer.ok) {
              accepted = { scheme, status: answer.status };
              schemeCache.set(candidate.value, { scheme, at: Date.now() });
              break;
            }
            if (answer.attempt.status !== 401) break;
          }
          results.push({
            name: candidate.name,
            shape: keyDiagnosis(candidate.name, raw),
            length: shape.length,
            plainCharacters: shape.plainCharacters,
            looksLikeExample: shape.looksLikeExample,
            tried,
            scheme: accepted?.scheme ?? null,
            status: accepted?.status ?? tried[tried.length - 1]?.status ?? 0,
            accepted: Boolean(accepted),
            detail: accepted ? "" : (tried[tried.length - 1]?.detail ?? ""),
          });
        }
        const working = results.find((entry) => entry.accepted);
        json(res, 200, {
          ...base,
          probe: {
            keys: results,
            working: working ? working.name : null,
            verdict: working
              ? `${working.name} is accepted by Anything${working.scheme && working.scheme !== "basic" ? ` as ${working.scheme === "x-api-key" ? "an X-API-Key header" : "a bearer token"} rather than Basic auth, and the bridge has switched to that` : ""}${results.length > 1 ? ", so the other stored key is the one that was being used before and can be removed" : ""}.`
              : [
                  `Anything refused ${results.length === 1 ? `the value stored in ${results[0]!.name}` : `all ${results.length} stored keys`} — ${results
                    .map((entry) => `${entry.name} answered ${entry.status || "nothing"}${entry.detail ? ` (${entry.detail})` : ""}`)
                    .join("; ")}.`,
                  results.some((entry) => entry.looksLikeExample)
                    ? "That value is the example printed in Anything's documentation, not a key: it was never replaced with a real one."
                    : results.some((entry) => !entry.plainCharacters)
                      ? "The value holds characters a key does not contain, so it is a paste artefact or another product's token."
                      : "The value is the right shape, so it is dead or from another account: a revoked key, or one created before a rotation.",
                  "Nothing in the code can fix that — only a live key can. In Anything: Settings → API Keys → Create key (expiry Never), copy it once, then paste it into this project as Anything_Key, type Sensitive, and redeploy: a changed variable does not reach an existing deployment.",
                ].join(" "),
          },
        });
        return;
      } finally {
        clearTimeout(timer);
      }
    }

    json(res, 200, base);
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST." });
    return;
  }

  const candidates = keys();
  if (!candidates.length) {
    json(res, 503, {
      ok: false,
      error: `No key is set on this project, so nothing is read. Add ANYTHING_API_KEY (any spelling of it works — Anything_Key, anything_api_key), type Sensitive, and redeploy: a changed variable does not reach an existing deployment.`,
    });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));

  let payload: { path?: unknown; generate?: unknown };
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { path?: unknown; generate?: unknown };
  } catch {
    json(res, 400, { ok: false, error: 'Send JSON like {"path":"/v0/api/projects"} to read, or {"generate":{"projectId":"prj_…","prompt":"…"}} to start a build.' });
    return;
  }

  /* The one write. Checked before the path rules, because it is a rule of its
     own: the read allowlist has no way to express "and this one POST". */
  if (payload.generate !== undefined) {
    await generate(payload.generate, candidates, res);
    return;
  }

  const asked = typeof payload.path === "string" ? payload.path : "";
  const target = anythingTarget(asked);
  if (!target.ok) {
    json(res, 400, { ok: false, error: target.reason });
    return;
  }
  if (!asked.startsWith(PROJECTS_PATH.split("?")[0]!) || asked.startsWith("/v0/api/projects/")) {
    /* Everything but the list is a single read: no shape to try instead. */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * Math.max(1, candidates.length));
    try {
      const rejected: Attempt[] = [];
      for (const candidate of candidates) {
        const only = await read(candidate.value, asked, controller.signal);
        if (only.ok) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Anything-Key", candidate.name);
          res.end(only.text);
          return;
        }
        rejected.push({ ...only.attempt, path: `${candidate.name} → ${only.attempt.path}` });
      }
      const last = rejected[rejected.length - 1]!;
      const unauthorised = rejected.every((attempt) => attempt.status === 401);
      json(res, unauthorised ? 401 : 502, {
        ok: false,
        status: last.status,
        attempts: rejected,
        error: unauthorised
          ? `Anything rejected ${rejected.length === 1 ? "the stored key" : `both stored keys`} (${keys()
              .map((candidate) => keyDiagnosis(candidate.name, process.env[candidate.name] ?? ""))
              .join("; ")}). Open /api/anything?probe=1 for what each one answers, and replace them with a key from Anything → Settings → API keys.`
          : `Anything answered ${last.status || "nothing"} on ${asked}: ${last.detail}.`,
      });
      return;
    } finally {
      clearTimeout(timer);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 3 * Math.max(1, candidates.length));
  try {
    /* Learn the working scheme before shaping a list, so the answer is about the
       list rather than about the header. A null here is not fatal: the reads
       below each try the schemes themselves. */
    for (const candidate of candidates) await discover(candidate.value, controller.signal);
    let result = await listAttempts(candidates[0]!.value, asked, controller.signal);
    for (const candidate of candidates.slice(1)) {
      if (result.ok) break;
      /* A 401 means the key was refused, not that the list is unreadable: the
         next stored key is worth a try before telling anyone it failed. */
      if (!result.attempts.every((attempt) => attempt.status === 401)) break;
      result = await listAttempts(candidate.value, asked, controller.signal);
    }
    if (result.ok) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Anything-Tried", result.tried.join(" "));
      res.end(result.text);
      return;
    }
    const last = result.attempts[result.attempts.length - 1]!;
    const statuses = [...new Set(result.attempts.map((attempt) => attempt.status || "no answer"))].join("/");
    json(res, 502, {
      ok: false,
      status: last.status,
      attempts: result.attempts,
      error:
        `${statuses} on ${PROJECTS_PATH}: ${last.detail}. ` +
        (result.email
          ? `The key itself works — it belongs to ${result.email}, which can see ${result.organizations} organization${result.organizations === 1 ? "" : "s"}.`
          : `The stored key${candidates.length === 1 ? "" : "s"} could not be checked against ${ME_PATH} either. Open /api/anything?probe=1 for what each one answers.`),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Nothing reads as "500" from the browser: a crash still answers in JSON. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await handle(req, res);
  } catch (problem) {
    if (res.headersSent) return;
    json(res, 500, {
      ok: false,
      error: `The Anything bridge itself failed: ${problem instanceof Error ? problem.message : String(problem)}`,
    });
  }
}

/* Exported for the tests: the two paths, so a test can assert the shape. */
export const ALLOWED = [ME_PATH, PROJECTS_PATH];
