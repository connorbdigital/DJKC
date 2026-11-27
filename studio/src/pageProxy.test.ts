import { describe, expect, it } from "vitest";
import { MAX_PAGE_CHARS, PAGE_HEADERS, proxyPage } from "./pageProxy";

const URL_ = "https://kaysie.sitebuildup.co.uk/prices.html";
const page = (body: string) => `<!doctype html><html><head><title>Prices</title></head><body>${body}</body></html>`;

describe("proxyPage — the page itself survives", () => {
  it("keeps the markup: the real header, the real nav, the real words", () => {
    const html = proxyPage(page(`<header><h1>What a night costs</h1></header><nav><a href="/faq.html">Questions</a></nav>`), URL_).html;
    expect(html).toContain("<header><h1>What a night costs</h1></header>");
    expect(html).toContain('<a href="/faq.html">Questions</a>');
    expect(html).toContain("<title>Prices</title>");
  });

  it("keeps the page's stylesheets and pictures, which is how it looks like itself", () => {
    const html = proxyPage(
      `<html><head><link rel="stylesheet" href="/assets/site.css"><style>:root{--pink:#ff2bd6}</style></head><body><img src="/img/booth.jpg" alt="Booth"></body></html>`,
      URL_
    ).html;
    expect(html).toContain('<link rel="stylesheet" href="/assets/site.css">');
    expect(html).toContain("--pink:#ff2bd6");
    expect(html).toContain('<img src="/img/booth.jpg" alt="Booth">');
  });

  it("points every relative address at the original site with a base", () => {
    const html = proxyPage(page("<p>hi</p>"), URL_).html;
    expect(html).toContain(`<base href="${URL_}">`);
    expect(html.indexOf("<base")).toBeLessThan(html.indexOf("<body"));
  });
});

describe("proxyPage — and nothing of it runs", () => {
  it("takes out script blocks, with their attributes and their contents", () => {
    const html = proxyPage(page('<script src="/app.js"></script><script>alert("x")</script><p>after</p>'), URL_).html;
    expect(html).not.toContain("script");
    expect(html).toContain("<p>after</p>");
  });

  it("takes out self-closing and upper-case scripts too", () => {
    const html = proxyPage(page('<SCRIPT type="module">do()</SCRIPT><script src="/x.js" defer />'), URL_).html;
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("takes out every inline handler", () => {
    const html = proxyPage(page(`<a href="/a" onclick="steal()">a</a><img src="/i.png" onerror='steal()'><div ONMOUSEOVER=steal()>z</div>`), URL_).html;
    expect(html.toLowerCase()).not.toContain("onclick");
    expect(html.toLowerCase()).not.toContain("onerror");
    expect(html.toLowerCase()).not.toContain("onmouseover");
    expect(html).toContain('<a href="/a">a</a>');
  });

  it("takes out javascript: addresses, however spelled", () => {
    const html = proxyPage(page(`<a href="javascript:void(0)">a</a><a href=' JavaScript:steal()'>b</a><a href="&#106;avascript:x">c</a>`), URL_).html;
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("takes out nested frames, plugins, refresh and any base of theirs", () => {
    const html = proxyPage(
      `<html><head><base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test"></head><body><iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y"></body></html>`,
      URL_
    ).html;
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("<embed");
    expect((html.match(/<base\b/g) ?? []).length).toBe(1);
  });

  it("strips the comments that hide a conditional script", () => {
    const html = proxyPage(page("<!--[if IE]><script src='/ie.js'></script><![endif]--><p>kept</p>"), URL_).html;
    expect(html).not.toContain("ie.js");
    expect(html).toContain("<p>kept</p>");
  });
});

describe("proxyPage — the awkward shapes", () => {
  it("wraps a fragment that has no html at all", () => {
    const html = proxyPage("<h1>Just a heading</h1>", URL_).html;
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h1>Just a heading</h1>");
    expect(html).toContain(`<base href="${URL_}">`);
  });

  it("adds a head when the page has an html element but no head", () => {
    const html = proxyPage("<html><body><p>x</p></body></html>", URL_).html;
    expect(html).toContain("<head><base");
  });

  it("cuts a page longer than the ceiling, and says so inside the page", () => {
    const long = page(`${"<p>a paragraph</p>".repeat(MAX_PAGE_CHARS / 16)}`);
    const result = proxyPage(long, URL_);
    expect(result.truncated).toBe(true);
    expect(result.html.length).toBeLessThan(long.length);
    expect(result.html).toContain("shown cut off");
    expect(result.html).toContain(URL_);
  });

  it("does not claim to have cut a page it did not cut", () => {
    const result = proxyPage(page("<p>short</p>"), URL_);
    expect(result.truncated).toBe(false);
    expect(result.html).not.toContain("shown cut off");
  });

  it("escapes an address that carries a quote, rather than breaking the attribute", () => {
    const awkward = "https://example.com/a?b=\"c\"";
    const html = proxyPage(page("<p>x</p>"), awkward).html;
    expect(html).toContain("&quot;");
    expect(html).not.toContain('<base href="https://example.com/a?b="c"">');
  });
});

describe("PAGE_HEADERS", () => {
  it("refuses scripts twice: no script-src, and no sniffing", () => {
    expect(PAGE_HEADERS["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(PAGE_HEADERS["Content-Security-Policy"]).not.toContain("script-src *");
    expect(PAGE_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(PAGE_HEADERS["Content-Type"]).toContain("text/html");
  });

  it("does not let the page phone home about where it is being shown", () => {
    expect(PAGE_HEADERS["Referrer-Policy"]).toBe("no-referrer");
  });
});
