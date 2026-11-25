import { describe, expect, it } from "vitest";
import { OFFERS, buildPitch, offerFor, pitchText } from "./pitch";
import { checkSite, type SiteCheck, type SiteReport } from "./sitecheck";

const page = (head: string, body: string) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

/** A page that fails nearly everything: the pitch has to survive that too. */
const bare = page("<title>Shop</title>", "<h1>Shop</h1><p>Buy things.</p>");
/** A page that does the mechanics properly. */
const good = page(
  `<title>Hearth &amp; Grain — stoneware and oak for the kitchen table</title>
   <meta name="description" content="Stoneware mugs, oak boards and linen from a small workshop in Leeds. Free delivery over £40, returns for 30 days, dispatched from UK warehouses.">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <link rel="canonical" href="https://hearthandgrain.example/">
   <meta property="og:title" content="Hearth &amp; Grain">
   <meta property="og:image" content="https://hearthandgrain.example/card.png">
   <script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"28.00"},"hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy"}}</script>`,
  `<h1>Hearth &amp; Grain</h1><img src="a.svg" alt="Stoneware mug in slate">
   <p>${"Stoneware is fired twice and glazed by hand, so every mug carries the marks of the day it was made. ".repeat(14)}</p>`
);

const report = (html: string, url = "https://prospect.example/"): SiteReport => checkSite(html, url);
const check = (id: string, status: SiteCheck["status"] = "fail"): SiteCheck => ({
  id,
  label: id.toUpperCase(),
  status,
  detail: `detail for ${id}`,
  because: `because of ${id}`,
});

describe("the pitch sheet", () => {
  it("opens with a sentence that names the site and counts what fails", () => {
    const pitch = buildPitch(report(bare, "https://www.prospect.example/"));
    expect(pitch.headline).toContain("prospect.example");
    expect(pitch.headline).not.toContain("www.");
    expect(pitch.headline).toMatch(/passes \d+ of 12 checks/);
    expect(pitch.headline).toMatch(/the \d+ that are failing are the ones that cost orders|the one that is failing is the one that costs orders/);
    expect(pitch.score).toBeLessThan(50);
  });

  it("shows at most five faults, worst first, each with what it costs", () => {
    const pitch = buildPitch(report(bare));
    expect(pitch.findings.length).toBeGreaterThan(0);
    expect(pitch.findings.length).toBeLessThanOrEqual(5);
    for (const finding of pitch.findings) {
      expect(finding.cost.length).toBeGreaterThan(20);
      expect(finding.cost).not.toBe(finding.detail);
    }
    const failures = pitch.findings.filter((finding) => finding.status === "fail").length;
    expect(pitch.findings[0]!.status).toBe("fail");
    expect(failures).toBeGreaterThan(0);
  });

  it("gives three things to do, in an order that starts with the cheapest loss", () => {
    const pitch = buildPitch(report(bare));
    expect(pitch.fixes).toHaveLength(3);
    expect(pitch.fixes[0]!.title).toMatch(/phone/i);
    expect(pitch.fixes).toHaveLength(3);
    expect(new Set(pitch.fixes.map((fix) => fix.title)).size).toBe(3);
  });

  it("picks the shop package when the product data is missing, the site package otherwise", () => {
    expect(offerFor(report(bare)).offer.id).toBe("shop");
    expect(offerFor(report(good)).offer.id).toBe("site");
    /* Nothing on the page at all is not a one-page job — there is no page. */
    expect(offerFor(report("<html><head><title>Hi</title></head><body></body></html>")).offer.id).toBe("site");
  });

  it("has something honest to say about a page that passes everything", () => {
    const pitch = buildPitch(report(good));
    expect(pitch.findings).toHaveLength(0);
    expect(pitch.score).toBe(100);
    expect(pitch.headline).toMatch(/all 12 checks/);
    expect(pitch.headline).toMatch(/being found/i);
    /* Nothing to fix, so the plan is standing advice rather than an empty list. */
    expect(pitch.fixes).toHaveLength(3);
    expect(pitch.fixes[0]!.title).not.toMatch(/fix/i);
  });

  it("turns into text that can be pasted without tidying", () => {
    const pitch = buildPitch(report(bare));
    const text = pitchText(pitch);
    expect(text).toContain(pitch.headline);
    expect(text).toContain("What is wrong, worst first:");
    expect(text).toContain("What to do, in this order:");
    expect(text).toContain(pitch.offer.price);
    expect(text).toContain("kaysie.sitebuildup.co.uk");
    expect(text).not.toMatch(/ {2,}/);
    expect(text.split("\n").length).toBeLessThan(30);
    /* One page means one page: the paste has to fit an email without scrolling much. */
    expect(text.length).toBeLessThan(2400);
  });

  it("prints the four packages the market research settled on", () => {
    expect(OFFERS.map((offer) => offer.price)).toEqual(["£600", "£1,800", "£4,500", "£60/month"]);
    expect(pitchText(buildPitch(report(bare)))).toContain("All four".toUpperCase() === "ALL FOUR" ? "£4,500" : "£4,500");
  });

  it("does not invent a fault when a check merely warns", () => {
    const warned: SiteReport = { ...report(good), checks: [check("title", "warn"), check("h1", "pass")] };
    const pitch = buildPitch(warned, "https://example.co.uk/");
    expect(pitch.findings).toHaveLength(1);
    expect(pitch.findings[0]!.status).toBe("warn");
    expect(pitch.score).toBe(50);
  });
});
