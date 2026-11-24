import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PACKS,
  PackError,
  packById,
  packEnv,
  packExpects,
  packInstalled,
  packManual,
  packSources,
  planFiles,
  resolvePack,
  sharedFiles,
  type Pack,
} from "./packs";
import { mergeManifestMany, packBody, preflightPack } from "./installer";
import { capabilityById } from "./features";
import type { InstalledFeature } from "./types";

describe("packs", () => {
  it("ships more than one, each named and explained", () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(3);
    for (const pack of PACKS) {
      expect(pack.name.length).toBeGreaterThan(0);
      expect(pack.summary.length).toBeGreaterThan(40);
      expect(pack.features.length).toBeGreaterThan(1);
      expect(pack.before.length).toBeGreaterThan(0);
    }
  });

  it("only ever lists capabilities that exist", () => {
    for (const pack of PACKS) {
      for (const id of pack.features) expect(capabilityById(id), `${pack.id} → ${id}`).toBeDefined();
    }
  });

  it("is self-contained: every dependency is inside the pack", () => {
    for (const pack of PACKS) {
      for (const capability of resolvePack(pack)) {
        for (const requirement of capability.requires) {
          if (requirement === "storage") continue;
          expect(pack.features, `${pack.id}: ${capability.id} needs ${requirement}`).toContain(requirement);
        }
      }
    }
  });

  it("orders storage before everything that writes to it", () => {
    const ordered = resolvePack(packById("bookings-desk")!).map((capability) => capability.id);
    expect(ordered[0]).toBe("storage-kv");
    expect(ordered.indexOf("booking-form-deposits")).toBeLessThan(ordered.indexOf("blocked-dates"));
    expect(ordered.indexOf("booking-form-deposits")).toBeLessThan(ordered.indexOf("notifications"));
    expect(ordered).toHaveLength(packById("bookings-desk")!.features.length);
  });

  it("refuses a pack with a dependency it does not carry", () => {
    const broken: Pack = { id: "broken", name: "Broken", summary: "A".repeat(50), features: ["blocked-dates"], before: ["x"] };
    expect(() => resolvePack(broken)).toThrow(PackError);
    expect(() => resolvePack(broken)).toThrow(/missing a dependency/);
  });

  it("refuses an id that is not in the library", () => {
    const unknown: Pack = { id: "ghost", name: "Ghost", summary: "A".repeat(50), features: ["storage-kv", "nope"], before: ["x"] };
    expect(() => resolvePack(unknown)).toThrow(/does not exist/);
  });

  it("spots a dependency loop instead of hanging", () => {
    const first = capabilityById("storage-kv")!;
    const second = capabilityById("calendar-feed")!;
    first.requires.push("calendar-feed");
    second.requires.push("storage-kv");
    try {
      const circular: Pack = {
        id: "loop",
        name: "Loop",
        summary: "A".repeat(50),
        features: ["storage-kv", "calendar-feed"],
        before: ["x"],
      };
      expect(() => resolvePack(circular)).toThrow(/dependency loop/);
    } finally {
      first.requires.pop();
      second.requires.pop();
    }
  });
});

describe("pack planning", () => {
  const capabilities = resolvePack(packById("bookings-desk")!);

  it("writes each shared file once and says who shares it", () => {
    const files = planFiles(capabilities, "");
    const store = files.filter((file) => file.destination === "api/store.ts");
    expect(store).toHaveLength(1);
    expect(store[0]!.from).toEqual(["storage-kv", "booking-desk"]);
    // No destination appears twice.
    expect(new Set(files.map((file) => file.destination)).size).toBe(files.length);
  });

  it("applies the folder prefix to destinations, not to source paths", () => {
    const [first] = planFiles([capabilityById("storage-kv")!], "vendor/dj");
    expect(first!.destination).toBe("vendor/dj/api/store.ts");
    expect(first!.path).toBe("api/store.ts");
    expect(first!.source).toBe("connorbdigital/DJKC");
  });

  it("unions env vars and manual steps without repeats", () => {
    const env = packEnv(capabilities);
    expect(new Set(env).size).toBe(env.length);
    expect(env).toContain("STRIPE_SECRET_KEY");
    expect(env).toContain("ADMIN_TOKEN");
    const manual = packManual(capabilities);
    expect(new Set(manual).size).toBe(manual.length);
    expect(sharedFiles(planFiles(capabilities, "")).map((file) => file.destination)).toContain("api/store.ts");
    expect(packSources(capabilities)).toEqual(["connorbdigital/DJKC"]);
  });

  it("marks expectations the pack satisfies itself, and leaves the rest open", () => {
    const desk = packExpects(resolvePack(packById("bookings-desk")!));
    expect(desk.find((entry) => entry.path === "api/notify.ts")?.internal).toBe(true);
    expect(desk.find((entry) => entry.path === "src/data.ts")?.internal).toBe(true);
    const list = packExpects(resolvePack(packById("list-and-desk")!));
    expect(list.find((entry) => entry.path === "src/data.ts")?.internal).toBe(false);
  });

  it("knows when a pack is already installed", () => {
    const pack = packById("list-and-desk")!;
    expect(packInstalled(pack, ["storage-kv"])).toBe(false);
    expect(packInstalled(pack, [...pack.features])).toBe(true);
  });
});

describe("pack manifest", () => {
  const entry = (id: string): InstalledFeature => ({
    id,
    name: id,
    version: "1.0.0",
    source: "connorbdigital/DJKC",
    sourceCommit: "e0d3519a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e",
    installedAt: "2026-11-24T07:10:00.000Z",
    files: [`${id}/file.ts`],
  });

  it("records a whole pack in one write, sorted, replacing re-installs", () => {
    const existing = `${JSON.stringify({ version: 1, features: [entry("mailing-list")] }, null, 2)}\n`;
    const merged = mergeManifestMany(existing, [entry("storage-kv"), entry("booking-desk"), entry("storage-kv")]);
    const parsed = JSON.parse(merged) as { features: InstalledFeature[] };
    expect(parsed.features.map((feature) => feature.id)).toEqual(["booking-desk", "mailing-list", "storage-kv"]);
    expect(merged.endsWith("\n")).toBe(true);
  });
});

describe("pack pull request body", () => {
  const pack = packById("new-site")!;
  const capabilities = resolvePack(pack);
  const files = planFiles(capabilities, "");
  const body = packBody(pack, {
    capabilities,
    files,
    sources: { "connorbdigital/DJKC": "e0d3519a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e" },
    paths: files.map((file) => file.destination),
    omitted: [],
  });

  it("names every feature with its version and the pinned commit", () => {
    for (const capability of capabilities) {
      expect(body).toContain(`**${capability.name}** \`${capability.version}\``);
    }
    expect(body).toContain("`e0d3519`");
  });

  it("states the prerequisites, and names shared files only when there are any", () => {
    expect(body).toContain("## Before you start");
    expect(body).toContain("does not scaffold one");
    expect(body).toContain("Reads from your project");
    expect(body).toContain("(provided by this pack)");

    const deskPack = packById("bookings-desk")!;
    const deskCapabilities = resolvePack(deskPack);
    const deskFiles = planFiles(deskCapabilities, "");
    const deskBody = packBody(deskPack, {
      capabilities: deskCapabilities,
      files: deskFiles,
      sources: { "connorbdigital/DJKC": "e0d3519" },
      paths: deskFiles.map((file) => file.destination),
      omitted: [],
    });
    expect(deskBody).toContain("Files several features share");
    expect(deskBody).toContain("`api/store.ts` — used by storage-kv, booking-desk");
  });

  it("is one pull request, not a merge", () => {
    expect(body).toContain("in one pull request");
    expect(body).toContain("Do not merge until");
    expect(body).toContain("studio/features.json");
  });

  it("admits a feature it could not read", () => {
    const short = packBody(pack, {
      capabilities,
      files,
      sources: { "connorbdigital/DJKC": "e0d3519" },
      paths: ["api/store.ts"],
      omitted: ["booking-chat"],
    });
    expect(short).toContain("left out: `booking-chat`");
  });
});

describe("pack preflight", () => {
  afterEach(() => vi.unstubAllGlobals());

  const files: Record<string, string> = {
    "connorbdigital/DJKC:api/store.ts": "export const command = () => 1;",
    "connorbdigital/DJKC:api/bookings.ts":
      'import { command } from "./store.js";\nimport { TIERS } from "../src/data.js";\nexport const x = command() + TIERS.length;',
    /* src/data.ts is deliberately absent: the pack must say so rather than guess. */
  };

  it("counts a dependency inside the pack as satisfied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = decodeURI(String(url).replace("https://api.github.com/repos/", "").split("?")[0]!);
        const [repo, ...rest] = path.split("/contents/");
        const key = `${repo}:${rest.join("/contents/")}`;
        const content = files[key];
        if (!content) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
        return new Response(JSON.stringify({ content: Buffer.from(content).toString("base64"), encoding: "base64" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    const pack = packById("list-and-desk")!;
    const check = await preflightPack({
      token: "t",
      pack: { ...pack, features: ["storage-kv"] },
      target: "kaysie/new-site",
      prefix: "",
    });
    expect(check.missingDependencies).toEqual([]);
    expect(check.files.map((file) => file.destination)).toEqual(["api/store.ts"]);

    const booking = await preflightPack({
      token: "t",
      pack: { ...pack, features: ["storage-kv", "booking-form-deposits"] },
      target: "kaysie/new-site",
      prefix: "",
    });
    expect(booking.missingDependencies).toEqual([]);
    expect(booking.unresolved.map((entry) => entry.specifier)).not.toContain("./store.js");
    expect(booking.unresolved.map((entry) => entry.specifier)).toContain("../src/data.js");
  });
});
