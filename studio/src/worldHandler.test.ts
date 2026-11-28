import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

const call = async (
  init: { method?: string; url?: string; host?: string; headers?: Record<string, string>; keepCache?: boolean } = {}
) => {
  const { default: handler, clearWorldCache } = await import("../api/world");
  if (!init.keepCache) clearWorldCache();
  const body: string[] = [];
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    end: (chunk: string) => {
      body.push(String(chunk));
      res.headersSent = true;
    },
  } as unknown as ServerResponse & { statusCode: number; headersSent: boolean };
  const req = {
    method: init.method ?? "GET",
    url: init.url ?? "/api/world",
    headers: { host: init.host ?? "studio.test", "x-forwarded-proto": "https", ...(init.headers ?? {}) },
  } as unknown as IncomingMessage;
  await handler(req, res);
  return { status: res.statusCode, headers, json: JSON.parse(body.join("") || "{}") as Record<string, unknown> };
};

const original = { ...process.env };

beforeEach(() => {
  process.env = { ...original };
  delete process.env.GITHUB_TOKEN;
  delete process.env.VERCEL_TOKEN;
  delete process.env.ANYTHING_API_KEY;
  delete process.env.Anything_Key;
});

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
});

describe("/api/world", () => {
  it("answers with the inventory even when nothing else can be reached", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")));
    const { status, json } = await call();
    expect(status).toBe(200);
    const world = json.world as { sources: { id: string; ok: boolean; note: string }[]; counts: { nodes: number } };
    expect(world.counts.nodes).toBeGreaterThan(100);
    const sources = Object.fromEntries(world.sources.map((source) => [source.id, source]));
    expect(sources.studio?.ok).toBe(true);
    expect(sources.sites?.ok).toBe(true);
    expect(sources.github?.ok).toBe(false);
    expect(sources.github?.note).toContain("GITHUB_TOKEN");
    expect(sources.anything?.ok).toBe(false);
    expect(sources.vercel?.ok).toBe(false);
    expect(sources.vercel?.note).toContain("VERCEL_TOKEN");
  });

  it("says GitHub is on when the token is set, and never prints the token", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret_value_123";
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")));
    const { json } = await call();
    const raw = JSON.stringify(json);
    expect(raw).toContain('"github"');
    expect(raw).not.toContain("ghp_secret_value_123");
  });

  it("brings the Anything projects in through the bridge", async () => {
    vi.stubGlobal("fetch", (input: string) => {
      expect(String(input)).toContain("/api/anything");
      return Promise.resolve(
        new Response(JSON.stringify({ projects: [{ id: "p1", name: "sitebuildup" }, { id: "p2", name: "storefront" }] }), {
          status: 200,
        })
      );
    });
    const { json } = await call();
    const world = json.world as { apps: { name: string }[]; counts: { apps: number }; sources: { id: string; ok: boolean }[] };
    expect(world.apps.map((app) => app.name)).toEqual(["sitebuildup", "storefront"]);
    expect(world.counts.apps).toBe(2);
    expect(world.sources.find((source) => source.id === "anything")?.ok).toBe(true);
  });

  it("reports a refused bridge as a sentence, not a silence", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}", { status: 401, statusText: "Unauthorized" })));
    const { json } = await call();
    const world = json.world as { sources: { id: string; ok: boolean; note: string }[] };
    const anything = world.sources.find((source) => source.id === "anything");
    expect(anything?.ok).toBe(false);
    expect(anything?.note).toContain("401");
  });

  it("is read-only", async () => {
    const { status, json } = await call({ method: "POST" });
    expect(status).toBe(405);
    expect(String(json.error)).toContain("GET only");
  });

  it("gives the same version for the same world, and an ETag to match", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")));
    const first = await call();
    const second = await call();
    expect((first.json.world as { version: string }).version).toBe((second.json.world as { version: string }).version);
    expect(first.headers.etag).toBe(`"${(first.json.world as { version: string }).version}"`);
  });
});

describe("/api/world — polling and bridges", () => {
  it("honours the ETag it advertises, so a poll that knows the version costs nothing", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")));
    const first = await call();
    const version = (first.json.world as { version: string }).version;

    /* The ETag is the version, quoted, exactly as the header said. */
    const again = await call({ headers: { "if-none-match": first.headers.etag! }, keepCache: true });
    expect(again.status).toBe(304);
    expect(JSON.stringify(again.json)).toBe("{}");
    expect(again.headers["x-world-cache"]).toBe("hit");

    /* A stale tag is still a full answer, not a 304. */
    const changed = await call({ headers: { "if-none-match": '"not-this-one"' }, keepCache: true });
    expect(changed.status).toBe(200);
    expect((changed.json.world as { version: string }).version).toBe(version);
  });

  it("answers HEAD with headers and no body", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")));
    const { status, headers, json } = await call({ method: "HEAD" });
    expect(status).toBe(200);
    expect(headers.etag).toBeTruthy();
    expect(JSON.stringify(json)).toBe("{}");
  });

  it("says which writes are available, and what pays for them", async () => {
    vi.stubGlobal("fetch", (input: string, init: RequestInit) => {
      const asked = JSON.parse(String(init.body)) as { path: string };
      expect(String(input)).toContain("/api/anything");
      if (asked.path === "/v0/api/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              email: "k@example.com",
              organizations: [
                { id: "o1", name: "Workspace", planDisplayName: "Pro 20k", creditsBalance: 12_340 },
                { id: "o2", name: "Second", planDisplayName: "Pro 20k", creditsBalance: 660 },
              ],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ projects: [{ id: "p1", name: "sitebuildup" }] }), { status: 200 }));
    });

    const { json } = await call();
    const world = json.world as {
      bridges: { id: string; read: boolean; write: string | null; credits: number | null; note: string }[];
      version: string;
      sources: { id: string; note: string }[];
    };
    const anything = world.bridges.find((bridge) => bridge.id === "anything")!;
    expect(anything.read).toBe(true);
    expect(anything.write).toBe("/v0/api/projects/{id}/generate");
    expect(anything.credits).toBe(13_000);
    expect(anything.note).toContain("13,000 credits");
    expect(anything.note).toContain("Pro 20k");

    /* No tokens: the other two bridges are honest about it, and neither claims a write. */
    const vercel = world.bridges.find((bridge) => bridge.id === "vercel")!;
    expect(vercel.read).toBe(false);
    expect(vercel.write).toBeNull();
    expect(world.bridges.every((bridge) => bridge.write === null || bridge.id === "anything")).toBe(true);

    /* The credits are in the source's own sentence too, where the HUD reads it. */
    expect(world.sources.find((source) => source.id === "anything")?.note).toContain("13,000 credits");
  });

  it("keeps the credits out of the version, so a balance changing does not rebuild the space", async () => {
    const withCredits = (credits: number) =>
      vi.stubGlobal("fetch", (_input: string, init: RequestInit) => {
        const asked = JSON.parse(String(init.body)) as { path: string };
        if (asked.path === "/v0/api/me") {
          return Promise.resolve(new Response(JSON.stringify({ organizations: [{ creditsBalance: credits }] }), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ projects: [{ id: "p1", name: "sitebuildup" }] }), { status: 200 }));
      });

    withCredits(1000);
    const first = await call();
    withCredits(9_999);
    const second = await call();
    expect((first.json.world as { version: string }).version).toBe((second.json.world as { version: string }).version);
    expect((first.json.world as { bridges: { credits: number }[] }).bridges[0]!.credits).toBe(1000);
    expect((second.json.world as { bridges: { credits: number }[] }).bridges[0]!.credits).toBe(9999);
  });

  it("says a send may be refused when the credits could not be read", async () => {
    vi.stubGlobal("fetch", (_input: string, init: RequestInit) => {
      const asked = JSON.parse(String(init.body)) as { path: string };
      if (asked.path === "/v0/api/me") return Promise.resolve(new Response("{}", { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify({ projects: [{ id: "p1", name: "sitebuildup" }] }), { status: 200 }));
    });
    const { json } = await call();
    const anything = (json.world as { bridges: { credits: number | null; note: string }[] }).bridges[0]!;
    expect(anything.credits).toBeNull();
    expect(anything.note).toContain("may be refused");
  });
});
