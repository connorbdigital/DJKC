import { beforeEach, describe, expect, it } from "vitest";
import { buildPitch, emailDraft, mailtoFor, nextToPitch, prospectId, toProspect } from "./pitch";
import { clearProspects, exportProspects, importProspects, loadProspects, removeProspect, saveProspect, setProspectStatus } from "./pitchStore";
import { checkSite } from "./sitecheck";

const page = (head: string, body: string) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const bare = page("<title>Shop</title>", "<h1>Shop</h1><p>Buy things.</p>");
const good = page(
  `<title>Hearth &amp; Grain — stoneware and oak for the kitchen table</title>
   <meta name="description" content="Stoneware mugs, oak boards and linen from a small workshop in Leeds. Free delivery over £40, returns for 30 days, dispatched from UK warehouses.">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <link rel="canonical" href="https://example.co.uk/">
   <meta property="og:title" content="Hearth &amp; Grain">
   <meta property="og:image" content="https://example.co.uk/card.png">
   <script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"28.00"},"hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy"}}</script>`,
  `<h1>Hearth &amp; Grain</h1><img src="a.svg" alt="Stoneware mug in slate"><p>${"Fired twice and glazed by hand. ".repeat(30)}</p>`
);

const sheetFor = (url: string, html = bare) => toProspect(buildPitch(checkSite(html, url), url));

/** Node has no localStorage; the browser the Studio runs in does. */
const installStorage = () => {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
};

beforeEach(() => {
  installStorage();
  clearProspects();
});

describe("the prospect list", () => {
  it("keeps a sheet and reads it back", () => {
    const prospect = sheetFor("https://first.example.co.uk/");
    saveProspect(prospect);
    const kept = loadProspects();
    expect(kept).toHaveLength(1);
    expect(kept[0]!.host).toBe("first.example.co.uk");
    expect(kept[0]!.sheet.headline).toContain("first.example.co.uk");
    expect(kept[0]!.status).toBe("new");
  });

  it("replaces the sheet for the same site on the same day instead of doubling it", () => {
    const first = sheetFor("https://first.example.co.uk/");
    saveProspect(first);
    saveProspect({ ...first, score: 99 });
    expect(loadProspects()).toHaveLength(1);
    expect(loadProspects()[0]!.score).toBe(99);
  });

  it("keeps a status once a person has set it", () => {
    const prospect = sheetFor("https://first.example.co.uk/");
    saveProspect(prospect);
    setProspectStatus(prospect.id, "sent");
    saveProspect({ ...prospect, score: 10 });
    expect(loadProspects()[0]!.status).toBe("sent");
  });

  it("forgets one without touching the rest", () => {
    const a = sheetFor("https://a.example.co.uk/");
    const b = sheetFor("https://b.example.co.uk/");
    saveProspect(a);
    saveProspect(b);
    removeProspect(a.id);
    expect(loadProspects().map((entry) => entry.host)).toEqual(["b.example.co.uk"]);
  });

  it("puts new sheets first and gives the same site the same id", () => {
    const a = sheetFor("https://a.example.co.uk/");
    const b = sheetFor("https://b.example.co.uk/");
    saveProspect(a);
    saveProspect(b);
    expect(loadProspects()[0]!.host).toBe("b.example.co.uk");
    expect(prospectId("https://a.example.co.uk/", "2026-11-20")).toBe(prospectId("https://www.a.example.co.uk", "2026-11-20"));
    expect(prospectId("https://a.example.co.uk/", "2026-11-20")).not.toBe(prospectId("https://a.example.co.uk/", "2026-11-21"));
  });

  it("says who to write to first: most to fix, cheapest to fix, unsent before sent", () => {
    const washy = sheetFor("https://nearly-perfect.example.co.uk/", good);
    const broken = sheetFor("https://broken.example.co.uk/");
    const middling = sheetFor("https://middling.example.co.uk/");
    const list = [washy, { ...middling, findings: 3 }, broken];
    expect(nextToPitch(list)!.host).toBe("broken.example.co.uk");
    expect(nextToPitch([{ ...broken, status: "sent" }, { ...middling, findings: 3, status: "new" }])!.host).toBe(
      "middling.example.co.uk"
    );
    expect(nextToPitch([{ ...broken, status: "won" }])).toBeNull();
  });
});

describe("the email", () => {
  it("is short, specific and sells nothing hard", () => {
    const { subject, body } = emailDraft(buildPitch(checkSite(bare, "https://prospect.example.co.uk/"), "https://prospect.example.co.uk/"));
    expect(subject).toContain("prospect.example.co.uk");
    expect(subject.length).toBeLessThan(80);
    expect(body).toContain("prospect.example.co.uk");
    expect(body).toMatch(/£/);
    expect(body.length).toBeLessThan(1400);
    expect(body).not.toMatch(/!!!|guarantee|act now|limited time/i);
    expect(body.split("\n").length).toBeLessThan(22);
    /* Two faults at most: a prospect who gets twelve bullets reads none. */
    expect(body.split("\n· ").length - 1).toBeLessThanOrEqual(2);
  });

  it("opens in a mail client without a broken address", () => {
    const link = mailtoFor(buildPitch(checkSite(bare, "https://prospect.example.co.uk/"), "https://prospect.example.co.uk/"), "hello@example.co.uk");
    expect(link.startsWith("mailto:hello%40example.co.uk?subject=")).toBe(true);
    expect(link).not.toContain("\n");
    expect(link).toContain(encodeURIComponent("£"));
  });
});


describe("the backup", () => {
  it("writes the list as a named file, not a bare array", () => {
    saveProspect(sheetFor("https://one.example/"));
    const text = exportProspects();
    const parsed = JSON.parse(text) as { kind: string; version: number; exportedAt: string; prospects: unknown[] };
    expect(parsed.kind).toBe("studio-pitch-backup");
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.prospects).toHaveLength(1);
  });

  it("restores into an empty browser, and says how much it added", () => {
    saveProspect(sheetFor("https://one.example/"));
    saveProspect(sheetFor("https://two.example/"));
    const text = exportProspects();
    clearProspects();
    expect(loadProspects()).toEqual([]);

    const restored = importProspects(text);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.added).toBe(2);
    expect(restored.updated).toBe(0);
    expect(loadProspects().map((p) => p.host)).toEqual(["two.example", "one.example"]);
  });

  it("merges rather than replaces, and never walks a status backwards", () => {
    const one = sheetFor("https://one.example/");
    saveProspect(one);
    const text = exportProspects();
    /* Since the backup: one has been written to, and a second has been found. */
    setProspectStatus(one.id, "sent");
    saveProspect(sheetFor("https://two.example/"));

    const restored = importProspects(text);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.added).toBe(0);
    expect(restored.updated).toBe(1);
    const kept = loadProspects();
    expect(kept.map((p) => p.host)).toEqual(["two.example", "one.example"]);
    expect(kept.find((p) => p.host === "one.example")?.status).toBe("sent");
  });

  it("refuses what is not one of its own files, in words a person can act on", () => {
    expect(importProspects("")).toEqual({ ok: false, reason: "That file is empty." });
    expect(importProspects("not json").ok).toBe(false);
    expect(String((importProspects("{\"hello\":1}") as { reason: string }).reason)).toContain("studio-pitch-backup");
    expect(String((importProspects('{"kind":"studio-pitch-backup","version":99,"prospects":[]}') as { reason: string }).reason)).toContain("newer Studio");
    expect(String((importProspects('{"kind":"studio-pitch-backup","version":1,"prospects":[]}') as { reason: string }).reason)).toContain("no readable prospects");
    /* A prospect missing its sheet is not a prospect. */
    const junk = JSON.stringify({ kind: "studio-pitch-backup", version: 1, prospects: [{ id: "x" }] });
    expect(importProspects(junk).ok).toBe(false);
  });
});
