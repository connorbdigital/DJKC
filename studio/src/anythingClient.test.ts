import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAnythingApps, loadAnythingList, loadAnythingProject, parseProjects, sendBrief, toApp } from "./anythingClient";
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

describe("every part, not the first screenful", () => {
  it("keeps all forty-one modules and says how many the project reported", () => {
    const files = Array.from({ length: 41 }, (_, index) => ({
      id: `f${index}`,
      name: `Part ${index + 1}`,
      moduleType: "component",
      path: null,
    }));
    const app = toApp(project(), info({ files }));
    expect(app.modules).toHaveLength(41);
    expect(app.modules.at(-1)).toBe("Part 41");
    expect(app.moduleCount).toBe(41);
  });
});

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

describe("the Anything list on its own", () => {
  const listBody = JSON.stringify({
    projects: Array.from({ length: 6 }, (_, index) => ({
      id: `prj_${index}`,
      name: `app ${index}`,
      organizationName: "connorbdigital",
      updatedAt: "2026-11-20T10:00:00.000Z",
    })),
  });

  it("lists every project without pretending to know what is inside them", async () => {
    const paths: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { path: string };
      paths.push(body.path);
      if (body.path === "/v0/api/me") {
        return new Response(JSON.stringify({ email: "k@example.com", organizations: [] }), { status: 200 });
      }
      return new Response(listBody, { status: 200 });
    });
    const result = await loadAnythingList();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projects).toHaveLength(6);
    expect(result.me?.email).toBe("k@example.com");
    /* One list call and one identity call: no detail request before you ask for one. */
    expect(paths.filter((path) => path.startsWith("/v0/api/projects/")).length).toBe(0);
    expect(paths.length).toBe(2);
  });

  it("reads one project when it is asked about", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { path: string };
      expect(body.path).toBe("/v0/api/projects/prj_9fk2");
      return new Response(
        JSON.stringify({ platform: "mobile", files: [{ name: "Home.tsx" }, { name: "Booking.tsx" }], latestPublishedUrl: "https://app.example.com/" }),
        { status: 200 }
      );
    });
    const result = await loadAnythingProject({ id: "prj_9fk2", name: "sitebuildup", organizationName: "connorbdigital", organizationId: "org_1", slug: null, createdAt: "", updatedAt: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.app.modules).toEqual(["Home.tsx", "Booking.tsx"]);
    expect(result.app.platform).toBe("mobile");
    expect(result.app.url).toBe("https://app.example.com/");
  });

  it("keeps a failed detail a failure, so the list can say so", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 }));
    const result = await loadAnythingProject({ id: "prj_x", name: "gone", organizationName: "o", organizationId: "o", slug: null, createdAt: "", updatedAt: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not found");
  });
});

describe("sending the brief", () => {
  it("posts one generate request and believes only a revision id", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ revisionId: "6b0c0d1e-1111-4222-8333-444455556666", threadId: "aa11bb22-3333-4444-8555-666677778888" }), { status: 200 });
    });

    const result = await sendBrief("prj_9fk2");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sent.revisionId).toBe("6b0c0d1e-1111-4222-8333-444455556666");
      expect(result.sent.threadId).toBe("aa11bb22-3333-4444-8555-666677778888");
    }
    expect(bodies).toHaveLength(1);
    const sent = bodies[0] as { generate: { projectId: string; prompt: string } };
    expect(sent.generate.projectId).toBe("prj_9fk2");
    /* The default brief is the audit, and it is long: this is the whole point. */
    expect(sent.generate.prompt.length).toBeGreaterThan(1000);
    expect(sent.generate.prompt).toContain("sitebuildup.co.uk");
  });

  it("reports the bridge's own words when it refuses, and never invents a success", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "Anything refused the stored key, so the brief was not sent." }), { status: 401 }));
    const refused = await sendBrief("prj_9fk2", "a brief that is long enough to be a brief, not a typo");
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/was not sent/i);

    /* A 200 with no revision id is not a sent brief. */
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const empty = await sendBrief("prj_9fk2", "a brief that is long enough to be a brief, not a typo");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toMatch(/no revision id/i);

    /* A network failure is a sentence, not an exception in the render. */
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const broken = await sendBrief("prj_9fk2");
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.reason).toBe("offline");
  });
});
