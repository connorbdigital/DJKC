import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRIEFS, briefsByService, briefsMarkdown } from "./atlasBriefs";
import {
  BUILT,
  PROJECTS,
  SITES,
  TOUR,
  auditAtlas,
  customProjectId,
  hashForNode,
  parseCustomProjects,
  nodeFromHash,
  responsiveFov,
  bestMatch,
  buildAtlas,
  compass,
  distance,
  kindColour,
  nearestDistrict,
  nearestNode,
  searchAtlas,
  STUDIO_COMPONENTS,
} from "./atlas";
import { CAPABILITIES } from "./features";
import { LINKS, TODOS } from "./resources";
import type { AnythingApp } from "./anythingClient";
import { PACKS, resolvePack } from "./packs";
import { BUILDER_STEPS } from "./processDoc";

const atlas = buildAtlas();

describe("the space", () => {
  it("holds every process, pack, step, project, brief and site exactly once", () => {
    const ids = atlas.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(atlas.nodes.filter((node) => node.kind === "capability")).toHaveLength(CAPABILITIES.length);
    expect(atlas.nodes.filter((node) => node.kind === "pack")).toHaveLength(PACKS.length);
    expect(atlas.nodes.filter((node) => node.kind === "step")).toHaveLength(BUILDER_STEPS.length);
    expect(atlas.nodes.filter((node) => node.kind === "project")).toHaveLength(PROJECTS.length);
    expect(atlas.nodes.filter((node) => node.kind === "brief")).toHaveLength(BRIEFS.length);
    expect(atlas.nodes.filter((node) => node.kind === "site")).toHaveLength(SITES.length);
    expect(atlas.nodes.filter((node) => node.kind === "todo")).toHaveLength(TODOS.length);
    expect(atlas.nodes.filter((node) => node.kind === "link")).toHaveLength(LINKS.length);
    expect(atlas.nodes.filter((node) => node.kind === "built")).toHaveLength(BUILT.length);
    expect(atlas.nodes.filter((node) => node.kind === "component")).toHaveLength(STUDIO_COMPONENTS.length);
    expect(atlas.nodes.length).toBe(
      CAPABILITIES.length +
        PACKS.length +
        BUILDER_STEPS.length +
        PROJECTS.length +
        BRIEFS.length +
        SITES.length +
        TODOS.length +
        LINKS.length +
        BUILT.length +
        STUDIO_COMPONENTS.length
    );
  });

  it("files every node under a real district, with finite coordinates", () => {
    const districts = new Set(atlas.districts.map((entry) => entry.id));
    for (const node of atlas.nodes) {
      expect(districts.has(node.district), node.id).toBe(true);
      for (const value of node.position) {
        expect(Number.isFinite(value), node.id).toBe(true);
        expect(Math.abs(value), node.id).toBeLessThan(200);
      }
      expect(node.line.length, node.id).toBeGreaterThan(10);
      expect(node.detail.length, node.id).toBeGreaterThan(30);
    }
  });

  it("only draws pathways between things that exist", () => {
    const ids = new Set(atlas.nodes.map((node) => node.id));
    for (const edge of atlas.edges) {
      expect(ids.has(edge.from), edge.from).toBe(true);
      expect(ids.has(edge.to), edge.to).toBe(true);
    }
    const installs = atlas.edges.filter((edge) => edge.kind === "installs");
    const expected = PACKS.reduce((total, pack) => total + resolvePack(pack).length, 0);
    expect(installs).toHaveLength(expected);
  });

  it("puts a node in the same place every time — a space you can learn", () => {
    const again = buildAtlas();
    expect(again.nodes.map((node) => node.id)).toEqual(atlas.nodes.map((node) => node.id));
    expect(again.nodes.map((node) => node.position)).toEqual(atlas.nodes.map((node) => node.position));
  });

  it("keeps districts far enough apart to be separate places", () => {
    for (const a of atlas.districts) {
      for (const b of atlas.districts) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.centre[0] - b.centre[0], a.centre[2] - b.centre[2]), `${a.id} vs ${b.id}`).toBeGreaterThan(45);
      }
    }
  });

  it("has a colour per kind, because the only legend is the colour", () => {
    expect(Object.keys(kindColour).sort()).toEqual([
      "app",
      "brief",
      "built",
      "capability",
      "component",
      "link",
      "pack",
      "project",
      "site",
      "step",
      "todo",
    ]);
    /* Ten kinds, ten colours: no two districts wear the same one. */
    expect(new Set(Object.values(kindColour)).size).toBe(Object.keys(kindColour).length);
  });
});

describe("searching the space", () => {
  it("finds a process by the word a person would type", () => {
    const hits = searchAtlas(atlas, "checkout");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((node) => node.label).join(" ")).toMatch(/checkout|Storefront/i);
  });

  it("finds a blog brief by its subject", () => {
    const hit = bestMatch(atlas, "staleness");
    expect(hit).toBeNull();
    const ai = bestMatch(atlas, "AI");
    expect(ai?.kind).toBeDefined();
    const typed = bestMatch(atlas, "chatgpt");
    expect(typed?.kind === "brief" || typed?.kind === "capability").toBe(true);
  });

  it("finds a site by its domain", () => {
    expect(bestMatch(atlas, "sitebuildup.co.uk")?.id).toBe("site-sitebuildup");
    expect(bestMatch(atlas, "ikea")?.id).toBe("site-ikea");
  });

  it("finds a builder step and a pack", () => {
    expect(bestMatch(atlas, "preflight")?.kind).toBe("step");
    expect(searchAtlas(atlas, "pathway").some((node) => node.kind === "pack")).toBe(true);
  });

  it("returns nothing rather than noise", () => {
    expect(searchAtlas(atlas, "")).toEqual([]);
    expect(searchAtlas(atlas, "zzzzqqq")).toEqual([]);
    expect(bestMatch(atlas, " ")).toBeNull();
  });

  it("ranks a title match above a passing mention", () => {
    const hits = searchAtlas(atlas, "checkout");
    expect(hits.slice(0, 3).some((node) => /checkout|storefront/i.test(node.label))).toBe(true);
    expect(hits.length).toBeGreaterThan(1);
    /* "affiliate" opens the post about affiliate commission, not the shop that
       happens to mention it in its body. */
    expect(searchAtlas(atlas, "affiliate")[0].id).toBe("brief-affiliate-vs-resell");
  });

  it("opens on a node from the URL", () => {
    const link = hashForNode("brief-affiliate-vs-resell");
    expect(link).toBe("#atlas/brief-affiliate-vs-resell");
    expect(nodeFromHash(link, atlas)?.id).toBe("brief-affiliate-vs-resell");
    /* A bare id is accepted too: people paste what the HUD shows. */
    expect(nodeFromHash("#brief-affiliate-vs-resell", atlas)?.id).toBe("brief-affiliate-vs-resell");
    expect(nodeFromHash("", atlas)).toBeNull();
    expect(nodeFromHash("#atlas/not-a-node", atlas)).toBeNull();
    expect(nodeFromHash("#", atlas)).toBeNull();
  });

  it("widens the field of view for portrait screens, within limits", () => {
    expect(responsiveFov(16 / 9)).toBe(62);
    expect(responsiveFov(1.6)).toBe(62);
    const portrait = responsiveFov(390 / 844);
    expect(portrait).toBeGreaterThan(62);
    expect(portrait).toBeLessThanOrEqual(86);
    expect(responsiveFov(0)).toBe(62);
    expect(responsiveFov(Number.NaN)).toBe(62);
    /* Wider never regresses as the phone gets narrower. */
    expect(responsiveFov(0.7)).toBeGreaterThanOrEqual(responsiveFov(0.9));
  });

  it("tours every district, and the tour's node stops exist", () => {
    const districts = new Set(atlas.districts.map((district) => district.id));
    expect(TOUR.length).toBeGreaterThanOrEqual(5);
    for (const stop of TOUR) {
      expect(districts.has(stop.district)).toBe(true);
      expect(stop.caption.length).toBeGreaterThan(20);
      if (stop.node) expect(atlas.nodes.some((node) => node.id === stop.node)).toBe(true);
    }
    /* One stop per district keeps the tour a tour, not a playlist. */
    expect(new Set(TOUR.map((stop) => stop.district)).size).toBe(TOUR.length);
  });

  it("measures the jump in metres", () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBe(5);
  });
});

describe("projects you add yourself", () => {
  it("turns anything stored into a shaped project, or drops it", () => {
    const parsed = parseCustomProjects([
      { label: "  Hilltop Cafe  ", line: "Menus and table bookings", href: "https://hilltop.example", stack: ["Astro", "Stripe", ""] },
      { label: "x" },
      { label: "Hilltop Cafe" },
      { label: "Danger", href: "javascript:alert(1)" },
      "not an object",
      null,
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: "project-own-hilltop-cafe", label: "Hilltop Cafe", href: "https://hilltop.example" });
    expect(parsed[0].stack).toEqual(["Astro", "Stripe"]);
    /* A URL scheme that is not http(s) is not a link. */
    expect(parsed[1].href).toBeUndefined();
    expect(parseCustomProjects("nonsense")).toEqual([]);
    expect(customProjectId("  ")).toBe("project-own-project");
  });

  it("adds them to the same district without moving the authored three", () => {
    const before = buildAtlas();
    const after = buildAtlas([{ id: "project-own-test", label: "Test project", line: "A thing", href: "https://example.com" }]);
    expect(after.nodes.length).toBe(before.nodes.length + 1);
    const added = after.nodes.find((node) => node.id === "project-own-test");
    expect(added?.district).toBe("projects");
    expect(added?.href).toBe("https://example.com");
    for (const original of before.nodes.filter((node) => node.district === "projects")) {
      const same = after.nodes.find((node) => node.id === original.id);
      expect(same?.position).toEqual(original.position);
    }
    /* The new node is inside the space, so you can fly to it. */
    expect(Math.abs(added!.position[0])).toBeLessThan(200);
    expect(Math.abs(added!.position[2])).toBeLessThan(200);
  });
});

describe("the audit", () => {
  it("finds nothing it cannot justify", () => {
    const findings = auditAtlas(atlas);
    expect(Array.isArray(findings)).toBe(true);
    for (const finding of findings) {
      expect(["high", "medium", "low"]).toContain(finding.severity);
      expect(finding.title.length).toBeGreaterThan(3);
      expect(finding.detail.length).toBeGreaterThan(20);
      if (finding.node) expect(atlas.nodes.some((node) => node.id === finding.node)).toBe(true);
    }
  });

  it("passes the proof check when every cited file exists", () => {
    const findings = auditAtlas(atlas, { exists: () => true });
    expect(findings.filter((finding) => finding.title === "Proof file is missing")).toHaveLength(0);
  });

  it("catches a missing proof, a dangling edge and a duplicate name", () => {
    const broken = {
      ...atlas,
      edges: [...atlas.edges, { from: "brief-checkout-losing-money", to: "ghost", kind: "proves" as const }],
      nodes: [
        ...atlas.nodes,
        { ...atlas.nodes[0]!, id: "dupe", label: atlas.nodes[0]!.label },
      ],
    };
    const findings = auditAtlas(broken, { exists: (path) => path !== "commerce/src/siteModel.ts" });
    const titles = findings.map((finding) => finding.title);
    expect(titles).toContain("Edge to nowhere");
    expect(titles).toContain("Two nodes with the same name");
    expect(titles).toContain("Proof file is missing");
    /* Worst first. */
    expect(findings[0].severity).toBe("high");
  });
});

describe("orientation", () => {
  it("says which district you are standing in", () => {
    expect(nearestDistrict(atlas, [92, 10, 0])).toBe("projects");
    expect(nearestDistrict(atlas, [0, 34, -92])).toBe("packs");
    expect(nearestDistrict(atlas, [0, 6, 96])).toBe("content");
    expect(nearestDistrict(atlas, [0, 30, 168])).toBe("gallery");
    expect(nearestDistrict(atlas, [-92, 14, 0])).toBe("builder");
  });

  it("finds the nearest node and how far it is", () => {
    const target = atlas.nodes.find((node) => node.kind === "site")!;
    const near = nearestNode(atlas, [target.position[0] + 1, target.position[1], target.position[2]]);
    expect(near?.node.id).toBe(target.id);
  });

  it("turns a yaw into a compass point", () => {
    expect(compass(0)).toBe("N");
    expect(compass(Math.PI)).toBe("S");
    expect(compass(-Math.PI / 2)).toBe("E");
    expect(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).toContain(compass(1.234));
  });
});

describe("the blog plan for sitebuildup.co.uk", () => {
  it("has a brief per idea, with unique slugs and a target query", () => {
    const slugs = BRIEFS.map((brief) => brief.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(BRIEFS.length).toBeGreaterThanOrEqual(12);
    for (const brief of BRIEFS) {
      expect(brief.query, brief.slug).toMatch(/[a-z]{3,}.*[a-z]{3,}/);
      expect(brief.promise.length, brief.slug).toBeGreaterThan(60);
      expect(brief.outline.length, brief.slug).toBeGreaterThanOrEqual(5);
      expect(brief.words, brief.slug).toBeGreaterThan(800);
      expect(brief.words, brief.slug).toBeLessThan(2500);
    }
  });

  it("argues from evidence, not adjectives", () => {
    for (const brief of BRIEFS) {
      expect(brief.facts.length, brief.slug).toBeGreaterThanOrEqual(3);
      for (const fact of brief.facts) {
        expect(fact.evidence.length, `${brief.slug}: ${fact.point}`).toBeGreaterThan(6);
        expect(/\d/.test(fact.point), `${brief.slug} has a number in: ${fact.point}`).toBe(true);
      }
    }
  });

  it("points at files that exist, so the proof is real", () => {
    for (const brief of BRIEFS) {
      for (const file of brief.proof) {
        const absolute = path.resolve("..", file);
        const local = path.resolve(file);
        expect(existsSync(absolute) || existsSync(local), `${brief.slug}: ${file}`).toBe(true);
      }
    }
  });

  it("hangs every brief off a process the Studio actually ships", () => {
    const ids = new Set(CAPABILITIES.map((capability) => capability.id));
    for (const brief of BRIEFS) expect(ids.has(brief.capability), brief.slug).toBe(true);
  });

  it("covers the services on the site, not just one of them", () => {
    const services = new Set(BRIEFS.map((brief) => brief.service));
    expect(services.size).toBeGreaterThanOrEqual(4);
    expect(services.has("e-commerce")).toBe(true);
    expect(services.has("seo-marketing")).toBe(true);
  });

  it("sorts by service for the calendar", () => {
    const sorted = briefsByService();
    expect(sorted).toHaveLength(BRIEFS.length);
    expect(sorted[0]!.service <= sorted[sorted.length - 1]!.service).toBe(true);
  });

  it("renders to markdown with every post in it", () => {
    const markdown = briefsMarkdown();
    expect(markdown.startsWith("# Blog plan for sitebuildup.co.uk")).toBe(true);
    for (const brief of BRIEFS) {
      expect(markdown).toContain(brief.title);
      expect(markdown).toContain(brief.query);
      expect(markdown).toContain(brief.proof[0]!);
    }
    expect(markdown.split("\n---\n").length).toBe(BRIEFS.length + 1);
  });
});


describe("apps built on anything.com", () => {
  const apps: AnythingApp[] = [
    {
      id: "prj_9fk2",
      name: "sitebuildup",
      organizationName: "Kaysie's Workspace",
      platform: "web",
      modules: ["Home", "Booking", "Prices"],
      url: "https://kaysie.sitebuildup.co.uk",
      updatedAt: "2026-11-18T16:40:00Z",
    },
    {
      id: "prj_7hd1",
      name: "storefront",
      organizationName: "Kaysie's Workspace",
      platform: "mobile",
      modules: [],
      updatedAt: "2026-11-12T11:05:00Z",
    },
  ];

  it("adds one sun per app, on an arm that exists only when there is something on it", () => {
    expect(buildAtlas().districts.some((district) => district.id === "anything")).toBe(false);
    const withApps = buildAtlas([], apps);
    expect(withApps.districts.some((district) => district.id === "anything")).toBe(true);
    const nodes = withApps.nodes.filter((node) => node.district === "anything");
    expect(nodes.map((node) => node.id)).toEqual(["app-prj_9fk2", "app-prj_7hd1"]);
    expect(nodes.every((node) => node.kind === "app")).toBe(true);
    /* Every part is on the node, not the first screenful, and the bullet says
       how many rather than repeating the first twelve names. */
    expect(nodes[0]!.modules).toEqual(["Home", "Booking", "Prices"]);
    expect(nodes[0]!.bullets.join(" ")).toMatch(/3 parts, listed below/);
    expect(nodes[0]!.href).toBe("https://kaysie.sitebuildup.co.uk");
    /* Never published: nothing to open, and it says so rather than inventing one. */
    expect(nodes[1]!.href).toBeUndefined();
    expect(nodes[1]!.detail).toMatch(/never been published/);
    /* The authored nodes do not move to make room. */
    const plain = buildAtlas();
    for (const node of plain.nodes) {
      expect(withApps.nodes.find((other) => other.id === node.id)?.position).toEqual(node.position);
    }
  });

  it("keeps them inside the space, in one place, and out of the search noise", () => {
    const again = buildAtlas([], apps);
    const once = buildAtlas([], apps);
    expect(again.nodes.map((node) => node.position)).toEqual(once.nodes.map((node) => node.position));
    for (const node of again.nodes.filter((entry) => entry.district === "anything")) {
      for (const value of node.position) expect(Math.abs(value)).toBeLessThan(200);
    }
    expect(bestMatch(again, "sitebuildup")?.kind).toBe("app");
  });

  it("stands on the diagonal, one arm's width east and north of the library", () => {
    const withApps = buildAtlas([], apps);
    const centre = (id: string) => withApps.districts.find((district) => district.id === id)!.centre;
    const library = centre("library");
    const projects = centre("projects");
    const anything = centre("anything");
    /* The three cardinal arms are the same distance apart; the diagonal is the
       corner of that square, not another axis. */
    expect(Math.abs(anything[0] - library[0])).toBeCloseTo(Math.abs(projects[0] - library[0]), 1);
    expect(Math.abs(anything[2] - library[2])).toBeCloseTo(Math.abs(projects[0] - library[0]), 1);
  });
});


describe("the shelf, in the space", () => {
  const shelf = atlas.nodes.filter((node) => node.district === "shelf");

  it("holds every task, every link and every round that shipped", () => {
    expect(shelf.filter((node) => node.kind === "todo")).toHaveLength(TODOS.length);
    expect(shelf.filter((node) => node.kind === "link")).toHaveLength(LINKS.length);
    expect(shelf.filter((node) => node.kind === "built")).toHaveLength(BUILT.length);
    /* Nothing on the shelf is anonymous: each one says why it is there. */
    for (const node of shelf) {
      expect(node.line.length, node.id).toBeGreaterThan(10);
      expect(node.detail.length, node.id).toBeGreaterThan(40);
    }
  });

  it("keeps a task's effort and area on the card, because that is the whole point", () => {
    for (const todo of TODOS) {
      const node = shelf.find((entry) => entry.id === `todo-${todo.id}`);
      expect(node, todo.id).toBeDefined();
      const text = node!.bullets.join(" ");
      expect(text.toUpperCase()).toContain(todo.state.toUpperCase());
      expect(text).toContain(todo.effort);
      expect(text).toContain(todo.where);
    }
  });

  it("links only to https, and every link says why you would open it", () => {
    for (const node of shelf.filter((entry) => entry.kind === "link")) {
      expect(node.href, node.id).toMatch(/^https:\/\//);
    }
    for (const link of LINKS) {
      expect(link.href).toMatch(/^https:\/\//);
      expect(link.note.length).toBeGreaterThan(20);
    }
  });

  it("says what shipped, in the same space as what is next", () => {
    const shipped = shelf.filter((entry) => entry.kind === "built");
    expect(shipped.map((node) => node.label)).toContain("The Shelf");
    expect(shipped.every((node) => node.bullets.length > 0)).toBe(true);
    expect(searchAtlas(atlas, "shipped").some((node) => node.kind === "built")).toBe(true);
    expect(searchAtlas(atlas, "the shelf").some((node) => node.id === "built-shelf")).toBe(true);
  });
});

describe("what a site says about itself", () => {
  it("gives every site what is there, what to look at, and whether it frames", () => {
    for (const site of SITES) {
      expect(site.what.length, site.id).toBeGreaterThan(30);
      expect(site.built.length, site.id).toBeGreaterThan(1);
      expect(site.look.length, site.id).toBeGreaterThan(1);
      expect(["opens", "may refuse"]).toContain(site.framing);
      for (const line of [...site.built, ...site.look]) expect(line.length, site.id).toBeGreaterThan(15);
    }
  });

  it("carries those lists onto the node the panel reads", () => {
    for (const site of SITES) {
      const node = atlas.nodes.find((entry) => entry.id === site.id)!;
      expect(node.kind).toBe("site");
      expect(node.sections?.map((section) => section.title)).toEqual([
        "What is there",
        ...(site.funnel ? ["The funnel, in the order it happens"] : []),
        "What to look at",
        ...(site.supply ? ["The supplier view"] : []),
      ]);
      expect(node.sections![0]!.lines).toEqual(site.built);
      expect(node.href).toBe(site.url);
      /* The panel opens the page; the sections explain it. */
      expect(node.detail).toMatch(/panel/);
    }
  });

  it("only claims a supplier view where there is one", () => {
    const withSupply = SITES.filter((site) => site.supply);
    /* The three that are ours: the site, the shop, and this space. */
    expect(withSupply.map((site) => site.id).sort()).toEqual(["site-ecommerce", "site-sitebuildup", "site-studio"]);
    for (const site of withSupply) {
      expect(site.supply!.gives.length).toBeGreaterThan(20);
      expect(site.supply!.wants.length).toBeGreaterThan(10);
      expect(site.supply!.check.length).toBeGreaterThan(20);
    }
  });

  it("gives a funnel only to the sites we built, with every step a real page", () => {
    const withFunnel = SITES.filter((site) => site.funnel);
    expect(withFunnel.map((site) => site.id).sort()).toEqual(["site-ecommerce", "site-sitebuildup"]);
    for (const site of withFunnel) {
      expect(site.funnel!.length).toBeGreaterThanOrEqual(3);
      expect(site.funnelNote?.length ?? 0).toBeGreaterThan(40);
      const host = new URL(site.url).host;
      for (const step of site.funnel!) {
        const url = new URL(step.path, site.url);
        expect(url.host).toBe(host);
        expect(url.protocol).toBe("https:");
        expect(step.step.length).toBeGreaterThan(3);
      }
      /* The node carries the same steps, absolute, so the plate reader can use them. */
      const node = atlas.nodes.find((entry) => entry.id === site.id)!;
      expect(node.funnel?.map((step) => step.url)).toEqual(
        site.funnel!.map((step) => new URL(step.path, site.url).toString())
      );
    }
    /* Nothing is invented for a site that is not ours. */
    for (const site of SITES.filter((entry) => !entry.funnel)) {
      expect(atlas.nodes.find((entry) => entry.id === site.id)!.funnel).toBeUndefined();
    }
  });
});

describe("the pages a project opens", () => {
  const projects = atlas.nodes.filter((node) => node.kind === "project");

  it("gives every project somewhere to go", () => {
    expect(projects.map((node) => node.id)).toEqual(["project-djkc", "project-studio", "project-commerce"]);
    for (const node of projects) {
      expect(node.href).toMatch(/^https:\/\//);
      expect(node.pages!.length).toBeGreaterThan(4);
      for (const page of node.pages!) {
        expect(page.href).toMatch(/^https:\/\//);
        expect(page.label.trim().length).toBeGreaterThan(2);
      }
    }
  });

  it("lists the DJ band's nine generated pages, none invented", () => {
    const node = atlas.nodes.find((entry) => entry.id === "project-djkc")!;
    expect(node.pages!.map((page) => page.href).sort()).toEqual(
      [
        "https://kaysie.sitebuildup.co.uk/",
        "https://kaysie.sitebuildup.co.uk/about.html",
        "https://kaysie.sitebuildup.co.uk/coverage.html",
        "https://kaysie.sitebuildup.co.uk/dj-hire-manchester.html",
        "https://kaysie.sitebuildup.co.uk/faq.html",
        "https://kaysie.sitebuildup.co.uk/how-much-does-a-dj-cost.html",
        "https://kaysie.sitebuildup.co.uk/prices.html",
        "https://kaysie.sitebuildup.co.uk/shows.html",
        "https://kaysie.sitebuildup.co.uk/wedding-dj.html",
      ].sort()
    );
  });

  it("deep-links the Studio's own pages into tabs it really has", () => {
    const node = atlas.nodes.find((entry) => entry.id === "project-studio")!;
    const ids = ["projects", "packs", "features", "search", "draft", "anything", "resources", "atlas"];
    const linked = node.pages!.map((page) => page.href.split("#tab=")[1]);
    expect(linked).toEqual(ids);
  });

  it("never lists the same page twice", () => {
    for (const node of projects) {
      const hrefs = node.pages!.map((page) => page.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});
