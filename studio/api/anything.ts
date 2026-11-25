import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ANYTHING_KEYS,
  ME_PATH,
  PROJECTS_PATH,
  anythingTarget,
  basicAuth,
  keyCandidates,
  keyDiagnosis,
  keyShape,
  type KeyCandidate,
} from "../src/anything.js";

/**
 * Lists the Anything projects this account can open, without the key ever
 * reaching the browser.
 *
 * Read-only by construction: the endpoint accepts POST, forwards a GET, and only
 * to the two documented paths. Auth is Anything's own — the key as Basic
 * username, empty password — and it is added here, never returned.
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

/**
 * One GET upstream, no retries: the caller decides what a failure means.
 */
async function read(
  key: string,
  path: string,
  signal: AbortSignal
): Promise<{ ok: true; status: number; text: string } | { ok: false; attempt: Attempt }> {
  const target = anythingTarget(path);
  if (!target.ok) return { ok: false, attempt: { path, status: 0, detail: target.reason } };
  try {
    const upstream = await fetch(target.url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: basicAuth(key) },
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
      readOnly: true,
      forwards: [ME_PATH, PROJECTS_PATH, `${PROJECTS_PATH}/{id}`],
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
          const answer = await read(candidate.value, ME_PATH, controller.signal);
          const raw = process.env[candidate.name] ?? "";
          const shape = keyShape(raw);
          results.push({
            name: candidate.name,
            shape: keyDiagnosis(candidate.name, raw),
            length: shape.length,
            plainCharacters: shape.plainCharacters,
            looksLikeExample: shape.looksLikeExample,
            status: answer.ok ? answer.status : answer.attempt.status,
            accepted: answer.ok,
            detail: answer.ok ? "" : answer.attempt.detail,
          });
        }
        const working = results.find((entry) => entry.accepted);
        json(res, 200, {
          ...base,
          probe: {
            keys: results,
            working: working ? working.name : null,
            verdict: working
              ? `${working.name} is accepted by Anything${results.length > 1 ? ", so the other stored key is the one that was being used before and can be removed" : ""}.`
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
      error: `Set ${ANYTHING_KEYS[0]} on this project to list Anything projects. Nothing is read until then.`,
    });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));

  let payload: { path?: unknown };
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { path?: unknown };
  } catch {
    json(res, 400, { ok: false, error: 'Send JSON like {"path":"/v0/api/projects"}.' });
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
