import { describe, expect, it } from "vitest";
import { availability, availabilityUrl, isComplete, priceFrom, validateProduct, variantBySku, variantsInStock } from "./catalog";
import { money } from "./money";
import { hoodie, thinMug, tote } from "./fixtures";

describe("catalogue", () => {
  it("accepts a product an agent could buy from without guessing", () => {
    expect(validateProduct(hoodie())).toEqual([]);
    expect(isComplete(hoodie())).toBe(true);
    expect(isComplete(tote())).toBe(true);
  });

  it("names every gap in a thin product, with the reason", () => {
    const fields = validateProduct(thinMug()).map((issue) => issue.field);
    expect(fields).toContain("slug");
    expect(fields).toContain("title");
    expect(fields).toContain("description");
    expect(fields).toContain("brand");
    expect(fields.some((field) => field.startsWith("images.alt"))).toBe(true);
    expect(fields).toContain("variant.price(MUG-1)");
    expect(fields).toContain("variant.stock(MUG-1)");
    expect(fields).toContain("returnPolicy.days");
    expect(fields).toContain("variant.identity(MUG-1)");
    const issue = validateProduct(thinMug()).find((entry) => entry.field === "brand");
    expect(issue?.because).toMatch(/rich results|Shopping/);
  });

  it("rejects a fake was-price and a malformed GTIN", () => {
    const product = hoodie();
    product.variants[0]!.compareAt = money(8000);
    product.variants[1]!.gtin = "12345";
    const problems = validateProduct(product);
    expect(problems.some((entry) => entry.problem.includes("compare-at"))).toBe(true);
    expect(problems.some((entry) => entry.problem.includes("GTIN"))).toBe(true);
  });

  it("calls availability the way schema.org names it", () => {
    const product = hoodie();
    expect(availability(product.variants[0]!)).toBe("InStock");
    expect(availability(product.variants[2]!)).toBe("OutOfStock");
    expect(availability({ ...product.variants[2]!, madeToOrder: true })).toBe("BackOrder");
    expect(availabilityUrl("InStock")).toBe("https://schema.org/InStock");
  });

  it("quotes 'from' using a variant that can actually be bought", () => {
    const product = hoodie();
    expect(priceFrom(product)?.amount).toBe(8900);
    expect(variantsInStock(product)).toHaveLength(2);
    const soldOut = { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) };
    expect(priceFrom(soldOut)).toBeNull();
  });

  it("finds a variant across the catalogue", () => {
    const found = variantBySku([hoodie(), tote()], "TOTE-NAT");
    expect(found?.product.slug).toBe("canvas-tote-bag");
    expect(variantBySku([hoodie()], "NOPE")).toBeNull();
  });
});
