import { describe, expect, it } from "vitest";
import { findOgImage, pagePreview } from "./sitecheck";

const page = (meta: string) => `<!doctype html><html><head><title>KC — a wedding DJ in Leeds</title>${meta}</head><body></body></html>`;

describe("the picture behind a link", () => {
  it("takes og:image and makes it absolute", () => {
    expect(findOgImage(page('<meta property="og:image" content="/img/kc.jpg">'), "https://kaysie.sitebuildup.co.uk/about.html")).toBe(
      "https://kaysie.sitebuildup.co.uk/img/kc.jpg"
    );
    expect(findOgImage(page('<meta content="https://cdn.example/kc.jpg" property="og:image">'), "https://kaysie.sitebuildup.co.uk/")).toBe(
      "https://cdn.example/kc.jpg"
    );
  });

  it("falls back to twitter:image, then to og:image:url", () => {
    expect(findOgImage(page('<meta name="twitter:image" content="https://cdn.example/t.jpg">'), "https://kaysie.sitebuildup.co.uk/")).toBe(
      "https://cdn.example/t.jpg"
    );
    expect(findOgImage(page('<meta property="og:image:url" content="https://cdn.example/u.jpg">'), "https://kaysie.sitebuildup.co.uk/")).toBe(
      "https://cdn.example/u.jpg"
    );
  });

  it("refuses a picture that is not https, or not there at all", () => {
    expect(findOgImage(page('<meta property="og:image" content="http://cdn.example/plain.jpg">'), "https://kaysie.sitebuildup.co.uk/")).toBe("");
    expect(findOgImage(page('<meta property="og:image" content="data:image/png;base64,AAAA">'), "https://kaysie.sitebuildup.co.uk/")).toBe("");
    expect(findOgImage(page(""), "https://kaysie.sitebuildup.co.uk/")).toBe("");
    expect(findOgImage(page('<meta property="og:image" content="   ">'), "https://kaysie.sitebuildup.co.uk/")).toBe("");
  });

  it("reads a whole card: image, title and the line under it", () => {
    const html = page(
      '<meta property="og:title" content="Wedding DJ in Leeds"><meta property="og:description" content="Eleven years, 300 weddings."><meta property="og:image" content="https://cdn.example/w.jpg">'
    );
    expect(pagePreview(html, "https://kaysie.sitebuildup.co.uk/wedding-dj.html")).toEqual({
      image: "https://cdn.example/w.jpg",
      title: "Wedding DJ in Leeds",
      description: "Eleven years, 300 weddings.",
    });
  });

  it("still gives a card when the page has no Open Graph at all", () => {
    const preview = pagePreview(page(""), "https://kaysie.sitebuildup.co.uk/");
    expect(preview.image).toBe("");
    expect(preview.title).toBe("KC — a wedding DJ in Leeds");
  });
});
