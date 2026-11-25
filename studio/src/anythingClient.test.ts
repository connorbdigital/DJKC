import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAnythingApps, parseProjects, toApp } from "./anythingClient";
import type { AnythingProject, AnythingProjectInfo } from "./anything";

const project = (overrides: Partial<AnythingProject> = {}): AnythingProject => ({
  id: "prj_9fk2",
  name: "sitebuildup",
  slug: "sitebuildup",
  organizationId: "org_1",
  organizationName: "Kaysie's Workspace",
  createdAt: "2026-10-02T09:12:00Z",
  updatedAt: "2026-11-18T16:40:00Z",
  ...overrides,
});

const info = (overrides: Partial<AnythingProjectInfo> = {}): AnythingProjectInfo => ({
  id: "prj_9fk2",
  name: "sitebuildup",
  slug: "sitebuildup",
  platform: "web",
  createdAt: "2026-10-02T09:12:00Z",
  updatedAt: "2026-11-18T16:40:00Z",
  devServerUrl: null,
  mobilePreviewUrl: null,
  publishedUrls: ["https://kaysie.sitebuildup.co.uk"],
  latestPublishedUrl: "https://kaysie.sitebuildup.co.uk",
  files: [
    { id: "f1", name: "Home", moduleType: "screen", path: "/" },
    { id: "f2", name: "Booking", moduleType: "screen", path: "/booking" },
  ],
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe("what the browser is allowed to believe", () => {
  it("shapes a list, drops entries without an id or a name, and dedupes", () => {
    const parsed = parseProjects({
      projects: [
        project(),
        project(),
        { id: "prj_x", name: "" },
        { name: "no id" },
        "nonsense",
        null,
        project({ id: "prj_2", name: "  storefront  ", organizationName: "" }),
      ],
    });
    expect(parsed.map((entry) => entry.id)).toEqual(["prj_9fk2", "prj_2"]);
    expect(parsed[1]!.name).toBe("storefront");
    expect(parsed[1]!.organizationName).toBe("Anything");
    expect(parseProjects(null)).toEqual([]);
    expect(parseProjects({ projects: "nope" })).toEqual([]);
  });

  it("turns a project and its detail into an app, and refuses anything but https", () => {
    expect(toApp(project(), info())).toMatchObject({
      id: "prj_9fk2",
      platform: "web",
      modules: ["Home", "Booking"],
      url: "https://kaysie.sitebuildup.co.uk",
    });
    /* An unknown platform is a web app, not a crash. */
    expect(toApp(project(), info({ platform: "quantum" as never })).platform).toBe("web");
    expect(
      toApp(project(), info({ latestPublishedUrl: "javascript:alert(1)", publishedUrls: [] })).url
    ).toBeUndefined();
    /* A bad newest URL still falls back to a published one that is fine. */
    expect(toApp(project(), info({ latestPublishedUrl: "javascript:alert(1)" })).url).toBe(
      "https://kaysie.sitebuildup.co.uk"
    );
    expect(toApp(project(), null).modules).toEqual([]);
  });
});

describe("loading the apps", () => {
  it("reads the list, then each project's own detail, through the deployment", async () => {
    const paths: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { path: string };
      paths.push(body.path);
      const payload = body.path.startsWith("/v0/api/me")
        ? { id: "u1", email: "k@example.com", name: "K", organizations: [] }
        : body.path === "/v0/api/projects?limit=100"
          ? { projects: [project(), project({ id: "prj_2", name: "storefront" })] }
          : { ...info(), id: body.path.split("/").pop(), latestPublishedUrl: null, publishedUrls: [] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const result = await loadAnythingApps({ limit: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.apps.map((app) => app.name)).toEqual(["sitebuildup", "storefront"]);
    expect(result.me?.email).toBe("k@example.com");
    expect(paths).toContain("/v0/api/projects/prj_9fk2");
    expect(paths).toContain("/v0/api/projects/prj_2");
  });

  it("keeps an app whose detail failed, and reports a list that failed", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { path: string };
      if (body.path === "/v0/api/projects?limit=100") {
        return new Response(JSON.stringify({ projects: [project()] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "boom" }), { status: 502 });
    });
    const partial = await loadAnythingApps();
    expect(partial.ok).toBe(true);
    if (partial.ok) {
      expect(partial.apps[0]!.name).toBe("sitebuildup");
      expect(partial.apps[0]!.modules).toEqual([]);
    }

    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ ok: false, error: "Set ANYTHING_API_KEY on this project." }), { status: 503 })
    );
    const missing = await loadAnythingApps();
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("ANYTHING_API_KEY");
  });

  it("never puts more than it was asked for into the space", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { path: string };
      const payload = body.path === "/v0/api/projects?limit=100"
        ? { projects: Array.from({ length: 30 }, (_, index) => project({ id: `prj_${index}`, name: `app ${index}` })) }
        : { ...info(), files: [] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const result = await loadAnythingApps({ limit: 3 });
    expect(result.ok && result.apps).toHaveLength(3);
  });
});
