import type { IncomingMessage, ServerResponse } from "node:http";
import { ANYTHING_KEYS, ME_PATH, PROJECTS_PATH, anythingTarget, basicAuth } from "../src/anything";

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

/** First variable that exists wins; the canonical name is preferred. */
const keyOf = (): string => {
  for (const name of ANYTHING_KEYS) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST." });
    return;
  }

  const key = keyOf();
  if (!key) {
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

  const target = anythingTarget(payload.path);
  if (!target.ok) {
    json(res, 400, { ok: false, error: target.reason });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: basicAuth(key) },
      redirect: "error",
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      json(res, 502, { ok: false, error: "That response is too large to pass through." });
      return;
    }
    if (upstream.status === 401) {
      json(res, 401, { ok: false, error: "Anything rejected that key. Check it is an API key, not a session token." });
      return;
    }
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(text);
  } catch (problem) {
    const message =
      problem instanceof Error && problem.name === "AbortError"
        ? "Anything did not answer in time."
        : "api.anything.com could not be reached from here.";
    json(res, 502, { ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}

/* Exported for the tests: the two paths, so a test can assert the shape. */
export const ALLOWED = [ME_PATH, PROJECTS_PATH];
