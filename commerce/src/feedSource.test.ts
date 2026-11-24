import { describe, expect, it } from "vitest";
import { checkFeedUrl, describeFeed, feedFileName, mergeManifest, redactUrl, type FeedRecord } from "./feedSource";

describe("feed URLs", () => {
  it("accepts an https feed and rejects everything a feed must not be", () => {
    expect(checkFeedUrl("https://www.dropshipforyou.co.uk/feeds/csv_feed.php?u=me%40example.com").ok).toBe(true);
    expect(checkFeedUrl("http://supplier.example/feed.csv")).toMatchObject({ ok: false, reason: expect.stringContaining("https") });
    expect(checkFeedUrl("https://user:pass@supplier.example/feed.csv").ok).toBe(false);
    expect(checkFeedUrl("https://localhost/feed.csv").ok).toBe(false);
    expect(checkFeedUrl("https://127.0.0.1/feed.csv").ok).toBe(false);
    expect(checkFeedUrl("https://192.168.1.10/feed.csv").ok).toBe(false);
    expect(checkFeedUrl("not a url").ok).toBe(false);
  });

  it("hides the account and the token, keeps the shape", () => {
    expect(redactUrl("https://www.dropshipforyou.co.uk/feeds/csv_feed.php?u=me%40example.com")).toBe(
      "https://www.dropshipforyou.co.uk/feeds/csv_feed.php?u=***"
    );
    expect(redactUrl("https://feeds.example.com/8f3c2a9d4b6e1f0a7c5d3b2e1a/swindon.csv")).toBe(
      "https://feeds.example.com/***/swindon.csv"
    );
    expect(redactUrl("https://feeds.example.com/catalogue.csv?a=1&b=2")).toBe("https://feeds.example.com/catalogue.csv?a=***&b=***");
    expect(redactUrl("nonsense")).toBe("<not a url>");
  });

  it("dates the file so yesterday's feed survives today's", () => {
    expect(feedFileName("Aosom UK", new Date("2026-11-20T09:00:00Z"))).toBe("aosom-uk-2026-11-20.csv");
    expect(feedFileName("", new Date("2026-01-02T00:00:00Z"))).toBe("supplier-2026-01-02.csv");
  });
});

describe("what arrived", () => {
  const trade = [
    "Product ID,Product Name,RRP,Stock,Image URL,MPN",
    "A1,Bamboo shelf,49.99,24,https://cdn.example.com/a.jpg,HF-1",
    "A2,Rattan basket,34.00,0,https://cdn.example.com/b.jpg,HF-2",
  ].join("\n");

  it("recognises a trade product file and its profile", () => {
    const summary = describeFeed(trade);
    expect(summary.rows).toBe(2);
    expect(summary.profile?.id).toBe("aosom");
    expect(summary.looksLikeProducts).toBe(true);
    expect(summary.columns).toContain("Product Name");
    expect(summary.ragged).toBe(0);
  });

  it("notices a stock file that is not a product file", () => {
    const stock = describeFeed("ID,SKU,STOCK,QTY\nA1,HF-1,instock,1\nA2,HF-2,outofstock,0");
    expect(stock.looksLikeProducts).toBe(false);
    expect(stock.rows).toBe(2);
  });

  it("says so when the file is ragged", () => {
    expect(describeFeed("id,title,price\n1,Thing\n2,Other,9.99").ragged).toBe(1);
  });
});

describe("the manifest", () => {
  const record = (file: string, at: string): FeedRecord => ({
    file,
    url: "https://feeds.example.com/x.csv?u=***",
    fetchedAt: at,
    bytes: 10,
    sha256: "abc",
    rows: 1,
    columns: ["id"],
    profile: "generic",
    ragged: 0,
  });

  it("puts the newest first and replaces the same file rather than duplicating it", () => {
    const first = mergeManifest(undefined, record("a-2026-11-19.csv", "2026-11-19T10:00:00Z"));
    const second = mergeManifest(first, record("a-2026-11-20.csv", "2026-11-20T10:00:00Z"));
    expect(second.feeds.map((entry) => entry.file)).toEqual(["a-2026-11-20.csv", "a-2026-11-19.csv"]);

    const redo = mergeManifest(second, record("a-2026-11-20.csv", "2026-11-20T11:00:00Z"));
    expect(redo.feeds).toHaveLength(2);
    expect(redo.feeds[0]!.fetchedAt).toBe("2026-11-20T11:00:00Z");
  });

  it("stays readable: sixty records at most", () => {
    let manifest = mergeManifest(undefined, record("f-0.csv", "2026-01-01T00:00:00Z"));
    for (let index = 1; index < 70; index += 1) {
      manifest = mergeManifest(manifest, record(`f-${index}.csv`, `2026-01-01T00:00:${String(index).padStart(2, "0")}Z`));
    }
    expect(manifest.feeds).toHaveLength(60);
    expect(manifest.feeds[0]!.file).toBe("f-69.csv");
  });
});
