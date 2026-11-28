import { describe, expect, it } from "vitest";
import {
  WORLD_POLL_MS,
  chipLine,
  creditsLeft,
  describeBridges,
  describeSources,
  describeWorld,
  readApps,
  readBridges,
  readWorld,
  sameWorld,
  worldTone,
  worldVersion,
  type WorldSnapshot,
} from "./world";

const snapshot = (over: Partial<WorldSnapshot> = {}): WorldSnapshot => ({
  version: "v1",
  builtAt: Date.now(),
  sources: [
    { id: "studio", label: "Studio", ok: true, at: Date.now(), note: "123 stars", count: 123 },
    { id: "anything", label: "Anything", ok: true, at: Date.now(), note: "2 projects", count: 2 },
  ],
  apps: [],
  deployments: [],
  bridges: [],
  counts: { nodes: 123, edges: 210, districts: 9, apps: 2, deployments: 0 },
  ...over,
});

describe("the world version", () => {
  const nodes = [{ id: "a" }, { id: "b" }];
  const apps = [{ name: "sitebuildup", modules: ["Home", "Prices"] }];
  const deployments = [{ url: "studio.example", state: "READY" }];

  it("does not change when the order changes", () => {
    const one = worldVersion({ nodes, apps, deployments });
    const two = worldVersion({ nodes: [...nodes].reverse(), apps, deployments });
    expect(two).toBe(one);
  });

  it("changes when a star is added", () => {
    expect(worldVersion({ nodes: [...nodes, { id: "c" }], apps, deployments })).not.toBe(
      worldVersion({ nodes, apps, deployments })
    );
  });

  it("changes when an app grows a part, because that is a different world", () => {
    expect(
      worldVersion({ nodes, apps: [{ name: "sitebuildup", modules: ["Home", "Prices", "FAQ"] }], deployments })
    ).not.toBe(worldVersion({ nodes, apps, deployments }));
  });

  it("changes when a deployment changes state", () => {
    expect(worldVersion({ nodes, apps, deployments: [{ url: "studio.example", state: "ERROR" }] })).not.toBe(
      worldVersion({ nodes, apps, deployments })
    );
  });

  it("is short enough to put in an ETag", () => {
    expect(worldVersion({ nodes, apps, deployments }).length).toBeLessThan(20);
  });
});

describe("reading a snapshot", () => {
  it("accepts the server's envelope and unwraps it", () => {
    const world = readWorld({ ok: true, world: snapshot() });
    expect(world?.version).toBe("v1");
    expect(world?.counts.nodes).toBe(123);
  });

  it("refuses anything without a version", () => {
    expect(readWorld({ ok: true, world: { sources: [] } })).toBeNull();
    expect(readWorld(null)).toBeNull();
    expect(readWorld("nope")).toBeNull();
    expect(readWorld([])).toBeNull();
  });

  it("drops sources it does not know, and keeps the ones it does", () => {
    const world = readWorld({
      world: snapshot({
        sources: [
          { id: "studio", label: "Studio", ok: true, at: 5, note: "x" },
          { id: "made-up", label: "Nope", ok: true, at: 5, note: "x" },
        ] as WorldSnapshot["sources"],
      }),
    });
    expect(world?.sources.map((source) => source.id)).toEqual(["studio"]);
  });

  it("treats a missing count as absent rather than zero", () => {
    const world = readWorld({ world: snapshot({ sources: [{ id: "github", label: "GitHub", ok: false, at: 0, note: "no token" }] }) });
    expect(world?.sources[0]?.count).toBeUndefined();
  });

  it("reads apps the way the browser's own loader does", () => {
    expect(
      readApps([
        { id: "p1", name: "sitebuildup", organizationName: "Kaysie", platform: "web", modules: ["Home"], updatedAt: "now" },
        { name: "" },
        { name: "storefront", modules: [] },
      ])
    ).toEqual([
      {
        id: "p1",
        name: "sitebuildup",
        organizationName: "Kaysie",
        platform: "web",
        modules: ["Home"],
        moduleCount: 1,
        updatedAt: "now",
      },
      {
        id: "app-storefront",
        name: "storefront",
        organizationName: "",
        platform: "web",
        modules: [],
        moduleCount: 0,
        updatedAt: "",
      },
    ]);
  });
});

describe("how the world stands", () => {
  it("is 'none' with no snapshot — not an error", () => {
    expect(worldTone(null)).toBe("none");
  });

  it("is live when every source answered and it is fresh", () => {
    expect(worldTone(snapshot())).toBe("live");
  });

  it("is partial when one source did not, because the rest still did", () => {
    const world = snapshot({
      sources: [
        { id: "studio", label: "Studio", ok: true, at: 1, note: "ok" },
        { id: "vercel", label: "Vercel", ok: false, at: 0, note: "no token" },
      ],
    });
    expect(worldTone(world)).toBe("partial");
  });

  it("is stale when it is older than a quarter of an hour", () => {
    const world = snapshot({ builtAt: Date.now() - 16 * 60_000 });
    expect(worldTone(world)).toBe("stale");
  });

  it("says the counts in one line", () => {
    const line = describeWorld(snapshot());
    expect(line).toContain("123 stars");
    expect(line).toContain("210 wires");
    expect(line).toContain("2/2 sources");
  });

  it("names the source that did not answer, and says why", () => {
    const world = snapshot({
      sources: [
        { id: "studio", label: "Studio", ok: true, at: 1, note: "123 stars" },
        { id: "vercel", label: "Vercel", ok: false, at: 0, note: "no VERCEL_TOKEN on this project" },
      ],
    });
    expect(describeSources(world)).toContain("Vercel: no — no VERCEL_TOKEN");
  });

  it("compares by version, so a poll that finds nothing new rebuilds nothing", () => {
    expect(sameWorld(snapshot(), snapshot())).toBe(true);
    expect(sameWorld(snapshot(), snapshot({ version: "v2" }))).toBe(false);
    expect(sameWorld(null, snapshot())).toBe(false);
  });

  it("says it in a chip a phone can hold", () => {
    expect(chipLine(null)).toBe("◉ World not read");
    expect(chipLine(snapshot())).toMatch(/^◉ Synced \d\d:\d\d$/);
    expect(
      chipLine(
        snapshot({
          sources: [
            { id: "studio", label: "Studio", ok: true, at: 1, note: "ok" },
            { id: "vercel", label: "Vercel", ok: false, at: 0, note: "no token" },
          ],
        })
      )
    ).toMatch(/^◉ Partial 1\/2 · \d\d:\d\d$/);
    expect(chipLine(snapshot({ builtAt: Date.now() - 20 * 60_000 }))).toMatch(/^◉ Stale · built /);
  });

  it("polls slowly enough to be polite", () => {
    expect(WORLD_POLL_MS).toBe(60_000);
  });
});

describe("the bridges", () => {
  it("reads what a deployment can do, and refuses to invent the rest", () => {
    const parsed = readBridges([
      { id: "anything", label: "Anything", read: true, write: "/v0/api/projects/{id}/generate", credits: 13_000, note: "13,000 credits" },
      { id: "vercel", label: "Vercel", read: false, write: null, credits: null, note: "no token" },
      /* Junk: an id it does not know, a duplicate, a write that is not a string. */
      { id: "salesforce", label: "?", read: true, write: "/x", credits: 1, note: "" },
      { id: "anything", label: "Anything again", read: true, write: null, credits: 0, note: "" },
      { id: "github", label: "GitHub", read: true, write: 42, credits: "lots", note: "" },
      "nonsense",
      null,
    ]);
    expect(parsed.map((bridge) => bridge.id)).toEqual(["anything", "vercel", "github"]);
    expect(parsed[0]!.credits).toBe(13_000);
    expect(parsed[2]!.write).toBeNull();
    expect(parsed[2]!.credits).toBeNull();
    expect(readBridges(undefined)).toEqual([]);
    expect(readBridges({})).toEqual([]);
  });

  it("travels through readWorld, so the browser sees it", () => {
    const world = readWorld({
      world: {
        ...snapshot(),
        bridges: [{ id: "anything", label: "Anything", read: true, write: "/v0/api/projects/{id}/generate", credits: 42, note: "" }],
      },
    });
    expect(world?.bridges).toHaveLength(1);
    expect(creditsLeft(world)).toBe(42);
    /* A snapshot from before bridges has none — and none is the honest answer. */
    expect(readWorld({ world: snapshot() })?.bridges).toEqual([]);
    expect(creditsLeft(null)).toBeNull();
  });

  it("says what can be written and what is left to pay with, in one line per bridge", () => {
    const world = snapshot({
      bridges: [
        { id: "anything", label: "Anything", read: true, write: "/v0/api/projects/{id}/generate", credits: 13_000, note: "" },
        { id: "vercel", label: "Vercel", read: false, write: null, credits: null, note: "" },
      ],
    });
    const said = describeBridges(world);
    expect(said).toContain("Anything: can /v0/api/projects/{id}/generate · 13,000 credits");
    expect(said).toContain("Vercel: no read");
    expect(describeBridges(null)).toContain("No bridges read");
  });
});
