/**
 * Whether this deployment can read GitHub on its own.
 *
 * When `GITHUB_TOKEN` is set on the project, `/api/github` answers and the gate
 * is not needed to browse. When it is not set — or on the dev server, where
 * there is no function at all — this says no and the token flow is unchanged.
 * One probe at start-up, not one per click.
 */

/** The sentinel passed wherever a token would go, so no call site has to change. */
export const PROXY_TOKEN = "proxy";

export interface ProxyIdentity {
  login: string;
}

export async function probeProxy(): Promise<ProxyIdentity | null> {
  try {
    const response = await fetch("/api/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/user" }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { login?: unknown };
    return typeof body.login === "string" && body.login ? { login: body.login } : null;
  } catch {
    return null;
  }
}
