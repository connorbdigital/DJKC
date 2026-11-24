import { describe, expect, it } from "vitest";
import { availabilityUrl, availability } from "./catalog";
import { breadcrumbJsonLd, faqJsonLd, llmsTxt, pageMeta, productJsonLd } from "./seo";
import { money } from "./money";
import { hoodie, thinMug } from "./fixtures";

const options = { url: "https://northline.example/products/heavyweight-hoodie", siteName: "Northline" };

describe("structured data", () => {
  it("publishes everything an agent reads, with canonical enumerations", () => {
    const product = hoodie();
    const variant = product.variants[0]!;
    const ld = productJsonLd(product, variant, options) as Record<string, any>;

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Heavyweight organic hoodie");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Northline" });
    expect(ld.sku).toBe("HOOD-CHR-S");
    expect(ld.gtin13).toBe("5061234567890");
    expect(ld.offer ?? ld.offers).toBeDefined();

    const offer = ld.offers;
    expect(offer.price).toBe("89.00"); // a decimal string, not pence, not a number
    expect(offer.priceCurrency).toBe("GBP");
    expect(offer.availability).toBe(availabilityUrl(availability(variant)));
    expect(offer.availability).toBe("https://schema.org/InStock");
    expect(offer.hasMerchantReturnPolicy.merchantReturnDays).toBe(30);
    expect(offer.hasMerchantReturnPolicy.returnFees).toBe("https://schema.org/FreeReturn");
    expect(offer.shippingDetails["@type"]).toBe("OfferShippingDetails");
  });

  it("shows a sold-out variant as out of stock rather than hiding it", () => {
    const product = hoodie();
    const ld = productJsonLd(product, product.variants[2]!, options) as Record<string, any>;
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("only claims a rating when there are real reviews", () => {
    const product = hoodie();
    const rated = productJsonLd(product, product.variants[0]!, options) as Record<string, any>;
    expect(rated.aggregateRating.ratingValue).toBe("4.7");
    expect(rated.aggregateRating.reviewCount).toBe(128);

    const unrated = productJsonLd({ ...product, rating: undefined }, product.variants[0]!, options) as Record<string, any>;
    expect(unrated.aggregateRating).toBeUndefined();
  });

  it("serialises without undefined keys, so the JSON-LD is valid", () => {
    const json = JSON.stringify(productJsonLd(hoodie(), hoodie().variants[0]!, options));
    expect(json).not.toContain("undefined");
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain("MerchantReturnPolicy");
  });

  it("carries no stale price: a thin product still emits a valid Offer", () => {
    const product = thinMug();
    const ld = productJsonLd(product, product.variants[0]!, options) as Record<string, any>;
    expect(ld.offers.price).toBe("0.00");
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("builds breadcrumbs, FAQs and an llms.txt with prices and policies", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Home", url: "https://northline.example/" },
      { name: "Hoodies", url: "https://northline.example/hoodies" },
    ]) as Record<string, any>;
    expect(crumbs.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2]);

    const faq = faqJsonLd([{ question: "How long is delivery?", answer: "2–3 working days." }]) as Record<string, any>;
    expect(faq.mainEntity[0]["@type"]).toBe("Question");

    const text = llmsTxt({
      name: "Northline",
      url: "https://northline.example",
      summary: "Organic cotton clothing made in Portugal.",
      currency: "GBP",
      facts: ["Free delivery over £50"],
      products: [{ title: "Heavyweight organic hoodie", url: "https://northline.example/products/heavyweight-hoodie", price: "£89.00" }],
      policies: { returns: "Free returns within 30 days", delivery: "2–3 working days", contact: "hello@northline.example" },
    });
    expect(text.startsWith("# Northline")).toBe(true);
    expect(text).toContain("include VAT");
    expect(text).toContain("Free returns within 30 days");
  });

  it("writes a title and description within search truncation limits", () => {
    const meta = pageMeta(hoodie(), "£89.00");
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.description.length).toBeLessThanOrEqual(155);
    expect(meta.description).toContain("£89.00");
    expect(meta.description).toContain("Free returns within 30 days");
  });

  it("never claims a sale price it does not have", () => {
    const product = hoodie();
    product.variants[0]!.compareAt = money(9900);
    const ld = productJsonLd(product, product.variants[0]!, options) as Record<string, any>;
    expect(ld.offers.price).toBe("89.00");
  });
});
