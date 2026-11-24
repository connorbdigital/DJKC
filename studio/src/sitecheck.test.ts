import { describe, expect, it } from "vitest";
import { checkSite, checkUrl } from "./sitecheck";

describe("which URLs may be fetched", () => {
  it("accepts a normal public https page", () => {
    const verdict = checkUrl("https://northline.co.uk/products/hoodie");
    expect(verdict.ok).toBe(true);
    expect(verdict.url?.hostname).toBe("northline.co.uk");
  });

  it("adds https when somebody pastes a bare domain", () => {
    expect(checkUrl("example-shop.co.uk").url?.protocol).toBe("https:");
  });

  it("refuses plain http, credentials and odd ports", () => {
    expect(checkUrl("http://example-shop.co.uk").reason).toMatch(/https/);
    expect(checkUrl("https://user:pass@example-shop.co.uk").reason).toMatch(/credentials/);
    expect(checkUrl("https://example-shop.co.uk:8080").reason).toMatch(/default https port/);
  });

  it("refuses the local network, by name and by address", () => {
    for (const url of [
      "https://localhost/",
      "https://something.local/",
      "https://metadata.google.internal/",
      "https://127.0.0.1/",
      "https://10.1.2.3/",
      "https://192.168.0.1/",
      "https://169.254.169.254/latest/meta-data/",
      "https://2130706433/",
      "https://0x7f000001/",
      "https://[::1]/",
    ]) {
      expect(checkUrl(url).ok, url).toBe(false);
    }
  });

  it("refuses nonsense with a reason a person can read", () => {
    expect(checkUrl("").reason).toBe("Enter a URL.");
    expect(checkUrl("https://").ok).toBe(false);
  });
});

const goodPage = `<!doctype html>
<html><head>
  <title>Heavyweight organic hoodie — Northline</title>
  <meta name="description" content="A 400gsm organic cotton hoodie, cut boxy, made in Portugal. £89 including VAT. Free returns within 30 days, delivered in 2 to 3 working days.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://northline.co.uk/products/heavyweight-hoodie">
  <meta property="og:title" content="Heavyweight organic hoodie">
  <meta property="og:image" content="https://northline.co.uk/hoodie.jpg">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","offers":{"@type":"Offer","price":"89.00","hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy"}}}</script>
</head>
<body>
  <h1>Heavyweight organic hoodie</h1>
  <img src="/hoodie.jpg" alt="Charcoal hoodie, front view">
  <img src="/hoodie-back.jpg" alt="Charcoal hoodie, back view">
  <p>${"A boxy organic cotton hoodie with ribbed cuffs and a double-layer hood. ".repeat(20)}</p>
  <p>Returns accepted within 30 days, free of charge.</p>
</body></html>`;

const badPage = `<html><head><title>Shop</title></head><body>
  <h1>Welcome</h1><h1>Featured</h1>
  <img src="/a.jpg"><img src="/b.jpg"><img src="/c.jpg">
  <div>Buy things</div>
</body></html>`;

describe("site report", () => {
  it("passes a page that does the basics properly", () => {
    const report = checkSite(goodPage, "https://northline.co.uk/products/heavyweight-hoodie");
    const status = Object.fromEntries(report.checks.map((check) => [check.id, check.status]));
    expect(status.title).toBe("pass");
    expect(status.description).toBe("pass");
    expect(status.h1).toBe("pass");
    expect(status.product).toBe("pass");
    expect(status.offer).toBe("pass");
    expect(status.returns).toBe("pass");
    expect(status.images).toBe("pass");
    expect(status.viewport).toBe("pass");
    expect(status.canonical).toBe("pass");
    expect(status.social).toBe("pass");
    expect(status.content).toBe("pass");
    expect(report.jsonLd).toContain("Product");
    expect(report.jsonLd).toContain("Offer");
    expect(report.verdict).toMatch(/Nothing broken|Everything/);
  });

  it("names what is wrong on a thin page, and why it matters", () => {
    const report = checkSite(badPage, "https://thin-shop.co.uk/");
    const status = Object.fromEntries(report.checks.map((check) => [check.id, check.status]));
    expect(status.description).toBe("fail");
    expect(status.h1).toBe("warn");
    expect(status.product).toBe("fail");
    expect(status.viewport).toBe("fail");
    expect(status.content).toBe("fail");
    expect(status.images).toBe("fail");
    expect(report.verdict).toMatch(/\d+ things to fix/);
    const product = report.checks.find((check) => check.id === "product");
    expect(product?.because).toMatch(/structured data/);
  });

  it("counts words outside scripts and styles", () => {
    const report = checkSite(
      `<html><head><title>A page with a title that is long enough</title></head><body>
        <script>${"var x = 1; ".repeat(500)}</script><style>${".a{color:red}".repeat(200)}</style>
        <p>Three words here</p></body></html>`,
      "https://example-shop.co.uk/"
    );
    expect(report.words).toBeLessThan(20);
  });

  it("reads the headline without its inline markup", () => {
    const report = checkSite("<html><body><h1>Good <em>hoodie</em> for winter</h1></body></html>", "https://example-shop.co.uk/");
    expect(report.h1).toEqual(["Good hoodie for winter"]);
  });

  it("never throws on a page that is barely HTML", () => {
    expect(() => checkSite("<html><body>", "https://example-shop.co.uk/")).not.toThrow();
    expect(() => checkSite("", "https://example-shop.co.uk/")).not.toThrow();
    const empty = checkSite("", "https://example-shop.co.uk/");
    expect(empty.checks.find((check) => check.id === "title")?.status).toBe("fail");
  });
});
