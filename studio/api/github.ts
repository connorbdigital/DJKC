import type { IncomingMessage, ServerResponse } from "node:http";
import { proxyTarget } from "../src/githubProxy.js";

/**
 * Reads GitHub on the server's behalf, so the browser never holds a token.
 *
 * Read-only on purpose. Browsing a repo is what needed a credential on every
 * page load; opening a branch or a pull request still goes through the token at
 * the gate, where the person doing it can see what they are authorising.
 *
 * The token never leaves this function: it is added to the upstream request and
 * nothing else. Paths are allowlisted by `proxyTarget`, GET only, and the
 * upstream status is passed through unchanged so the client can tell a 404 from
 * a 401 without guessing.
 *
 * Scope note: this deployment sits behind Vercel Authentication, so "anyone who
 * can reach this function" means "anyone you let into the Studio". If the Studio
 * is ever made public, remove this route first.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 4_000_000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST." });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    json(res, 503, {
      ok: false,
      error: "GITHUB_TOKEN is not set on this project, so the proxy is off. Paste a token at the gate instead.",
    });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
    if (chunks.reduce((total, part) => total + part.length, 0) > 8_192) {
      json(res, 413, { ok: false, error: "That body is too large." });
      return;
    }
  }

  let payload: { path?: unknown; method?: unknown };
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { path?: unknown; method?: unknown };
  } catch {
    json(res, 400, { ok: false, error: "Send JSON like {\"path\":\"/user\"}." });
    return;
  }

  const method = typeof payload.method === "string" ? payload.method.toUpperCase() : "GET";
  if (method !== "GET") {
    json(res, 403, { ok: false, error: "The proxy is read-only. Paste a token at the gate to write." });
    return;
  }

  const target = proxyTarget(payload.path);
  if (!target.ok) {
    json(res, 400, { ok: false, error: target.reason });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kc-studio",
      },
      redirect: "error",
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      json(res, 502, { ok: false, error: "That response is too large to pass through." });
      return;
    }
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(text);
  } catch (problem) {
    const message = problem instanceof Error && problem.name === "AbortError" ? "GitHub did not answer in time." : "GitHub could not be reached from here.";
    json(res, 502, { ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}
