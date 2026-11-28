import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

const call = async (init: { method?: string; url?: string; host?: string } = {}) => {
  const { default: handler, clearWorldCache } = await import("../api/world");
  clearWorldCache();
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
    headers: { host: init.host ?? "studio.test", "x-forwarded-proto": "https" },
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
