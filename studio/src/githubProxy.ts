/**
 * The rules for the GitHub proxy, kept separate from the handler so they can be
 * tested without a request.
 *
 * The proxy exists so a token does not have to live in a browser tab. It is
 * deliberately **read-only**: browsing repos is the thing that needed a
 * credential on every page, and writing — a file, a branch, a pull request —
 * still asks for a token in the gate. A read-only proxy that leaks is a bad
 * day; a write-capable one that leaks is a repository.
 *
 * Everything else is refused rather than sanitised: an allowlist of prefixes,
 * GET only, no absolute URLs, no traversal, no credentials in the path.
 */

export const GITHUB_API = "https://api.github.com";

/** Prefixes the proxy will forward. Longest first is not needed: these do not overlap in a way that matters. */
export const ALLOWED_PREFIXES = ["/user", "/repos/", "/search/code", "/rate_limit"] as const;

export const READ_ONLY_MESSAGE =
  "The Studio reads GitHub through its own server, which is read-only. Paste a token at the gate to open a branch or a pull request.";

export type ProxyTarget = { ok: true; url: string } | { ok: false; reason: string };

export function proxyTarget(rawPath: unknown): ProxyTarget {
  if (typeof rawPath !== "string" || rawPath.length === 0) return { ok: false, reason: "Send a path, e.g. /user." };
  if (rawPath.length > 500) return { ok: false, reason: "That path is too long." };
  if (!rawPath.startsWith("/")) return { ok: false, reason: "A path must start with /." };
  /* Absolute URLs, protocol-relative URLs and traversal are the three ways a
     proxy gets pointed somewhere it was never meant to go. */
  if (rawPath.startsWith("//")) return { ok: false, reason: "Protocol-relative paths are not forwarded." };
  if (rawPath.includes("//")) return { ok: false, reason: "Empty path segments are not forwarded." };
  if (rawPath.includes("..")) return { ok: false, reason: "Traversal is not forwarded." };
  if (rawPath.includes("\\")) return { ok: false, reason: "Backslashes are not forwarded." };
  if (rawPath.includes("@")) return { ok: false, reason: "Credentials are not forwarded." };
  if (/[\s]/.test(rawPath)) return { ok: false, reason: "Whitespace is not forwarded." };
  if (!ALLOWED_PREFIXES.some((prefix) => rawPath === prefix || rawPath.startsWith(prefix))) {
    return { ok: false, reason: `Only ${ALLOWED_PREFIXES.join(", ")} are forwarded.` };
  }
  /* A repository path has to name one: /repos/ on its own is a 404 upstream, so
     refusing it here keeps the rule "a forwarded path is a path that works". */
  if (rawPath.startsWith("/repos/")) {
    const segments = rawPath.slice("/repos/".length).split("?")[0]!.split("/").filter(Boolean);
    if (segments.length < 2) return { ok: false, reason: "A repository path needs an owner and a name." };
  }
  return { ok: true, url: `${GITHUB_API}${rawPath}` };
}

/** The proxy speaks GET and nothing else. */
export function allowsMethod(method: unknown): boolean {
  return typeof method === "string" && method.toUpperCase() === "GET";
}
