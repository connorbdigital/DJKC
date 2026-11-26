import { describe, expect, it } from "vitest";
import { buildSpace, inbound, internalLinks, mergeLive, pageId } from "./atlasSpace";

const WORK = pageId("https://kaysie.sitebuildup.co.uk/work");

const pages = [
  { label: "Work", href: "https://kaysie.sitebuildup.co.uk/work" },
  { label: "Home", href: "https://kaysie.sitebuildup.co.uk/" },
  { label: "Enquire", href: "https://kaysie.sitebuildup.co.uk/enquire" },
];

describe("a project's own space", () => {
  it("puts the project in the middle and its pages around it, in a stable order", () => {
    const space = buildSpace("Kaysie", pages[1]!.href, pages);
    expect(space.hub).toMatchObject({ kind: "hub", x: 0, y: 0 });
    expect(space.nodes.map((node) => node.label)).toEqual(["Enquire", "Work"]);
    expect(space.nodes.map((node) => node.id)).toEqual([
      pageId("https://kaysie.sitebuildup.co.uk/enquire"),
      pageId("https://kaysie.sitebuildup.co.uk/work"),
    ]);
    for (const node of space.nodes) expect(Math.hypot(node.x, node.y)).toBeCloseTo(0.62, 5);
    /* The home page is the hub, so it is not drawn twice. */
    expect(space.nodes.map((node) => node.href)).not.toContain(pages[1]!.href);
  });

  it("keeps every part that has a name and no address (an app's modules)", () => {
    const modules = buildSpace("Kaysie app", "https://app.example", [
      { label: "Booking form", href: "" },
      { label: "Calendar feed", href: "" },
      { label: "Admin desk", href: "" },
    ]);
    expect(modules.nodes.map((node) => node.label)).toEqual(["Admin desk", "Booking form", "Calendar feed"]);
    expect(new Set(modules.nodes.map((node) => node.id)).size).toBe(3);
    expect(modules.nodes.every((node) => node.href === "")).toBe(true);
  });

  it("gives the same shape every time it is opened", () => {
    const a = buildSpace("Kaysie", pages[1]!.href, pages);
    const b = buildSpace("Kaysie", pages[1]!.href, [...pages].reverse());
    expect(a.nodes).toEqual(b.nodes);
  });

  it("treats a trailing slash and a fragment as the same page", () => {
    expect(pageId("https://site.co.uk/work/")).toBe(pageId("https://site.co.uk/work#top"));
    expect(pageId("https://site.co.uk/")).toBe(pageId("https://site.co.uk"));
    expect(pageId("")).toBe("page");
  });

  it("draws the known pages as streams from the hub, and says they are known", () => {
    const space = buildSpace("Kaysie", pages[1]!.href, pages);
    expect(space.edges).toHaveLength(2);
    for (const edge of space.edges) {
      expect(edge).toMatchObject({ from: space.hub.id, source: "known" });
    }
  });
});

describe("links read off the page itself", () => {
  const html = `
    <a href="/work">Our work</a>
    <a href="https://kaysie.sitebuildup.co.uk/work/">Our work again</a>
    <a href="#top">Back to top</a>
    <a href="mailto:hi@kaysie.co.uk">Email</a>
    <a href="https://instagram.com/kaysie">Instagram</a>
    <a href="/enquire"><span>Enquire</span></a>`;

  it("makes anchors absolute and keeps only this site", () => {
    const links = internalLinks(html, "https://kaysie.sitebuildup.co.uk/");
    expect(links).toEqual([
      { label: "Our work", href: "https://kaysie.sitebuildup.co.uk/work" },
      { label: "Enquire", href: "https://kaysie.sitebuildup.co.uk/enquire" },
    ]);
  });

  it("drops a link back to the page it was read from", () => {
    const links = internalLinks('<a href="/">Home</a><a href="/work">Work</a>', "https://kaysie.sitebuildup.co.uk/");
    expect(links.map((link) => link.label)).toEqual(["Work"]);
  });

  it("returns nothing rather than guessing when the base is not a URL", () => {
    expect(internalLinks(html, "not a url")).toEqual([]);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join("");
    expect(internalLinks(many, "https://site.co.uk/", 5)).toHaveLength(5);
  });
});

describe("folding live links into the space", () => {
  it("adds pages that were not on the ring, once, and draws the stream", () => {
    const space = mergeLive(buildSpace("Kaysie", "https://kaysie.sitebuildup.co.uk/", pages), WORK, [
      { label: "Journal", href: "https://kaysie.sitebuildup.co.uk/journal" },
      { label: "Journal", href: "https://kaysie.sitebuildup.co.uk/journal/" },
      { label: "Home", href: "https://kaysie.sitebuildup.co.uk/" },
    ]);
    const journalId = pageId("https://kaysie.sitebuildup.co.uk/journal");
    expect(space.nodes.filter((node) => node.id === journalId)).toHaveLength(1);
    expect(space.edges.some((edge) => edge.from === WORK && edge.to === journalId && edge.source === "live")).toBe(true);
    expect(space.edges.some((edge) => edge.from === WORK && edge.to === space.hub.id && edge.source === "live")).toBe(true);
    const work = space.nodes.find((node) => node.id === WORK)!;
    const journal = space.nodes.find((node) => node.id === journalId)!;
    expect(journal.read).toBe(false);
    expect(work.read).toBe(true);
    expect(Math.hypot(journal.x, journal.y)).toBeGreaterThan(Math.hypot(work.x, work.y));
  });

  it("does not draw the same stream twice when a page is read again", () => {
    const once = mergeLive(buildSpace("Kaysie", "https://kaysie.sitebuildup.co.uk/", pages), WORK, [
      { label: "Journal", href: "https://kaysie.sitebuildup.co.uk/journal" },
    ]);
    const twice = mergeLive(once, WORK, [{ label: "Journal", href: "https://kaysie.sitebuildup.co.uk/journal" }]);
    expect(twice.edges).toEqual(once.edges);
    expect(twice.nodes).toHaveLength(once.nodes.length);
  });

  it("upgrades a stream the record already had instead of drawing it twice", () => {
    const seed = buildSpace("Kaysie", "https://kaysie.sitebuildup.co.uk/", pages);
    const space = mergeLive(seed, seed.hub.id, [
      { label: "Prices", href: "https://kaysie.sitebuildup.co.uk/prices" },
    ]);
    const streams = space.edges.filter((edge) => edge.to === pageId("https://kaysie.sitebuildup.co.uk/prices"));
    expect(streams).toHaveLength(1);
    expect(streams[0]!.source).toBe("live");
  });

  it("counts the streams coming in, busiest first", () => {
    const space = mergeLive(buildSpace("Kaysie", "https://kaysie.sitebuildup.co.uk/", pages), WORK, [
      { label: "Home", href: "https://kaysie.sitebuildup.co.uk/" },
      { label: "Enquire", href: "https://kaysie.sitebuildup.co.uk/enquire" },
    ]);
    const ranked = inbound(space);
    expect(ranked.find((row) => row.id === pageId("https://kaysie.sitebuildup.co.uk/enquire"))!.count).toBeGreaterThan(
      ranked.find((row) => row.id === WORK)!.count
    );
  });
});
