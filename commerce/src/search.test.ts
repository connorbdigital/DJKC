import { describe, expect, it } from "vitest";
import { buildIndex, editDistance, search, suggest, tokenise, type Synonym } from "./search";
import { hoodie, tote } from "./fixtures";

const synonyms: Synonym[] = [
  { term: "jumper", means: ["Hoodies"] },
  { term: "sweatshirt", means: ["Hoodies"] },
  { term: "bag", means: ["Bags"] },
];

const index = buildIndex([hoodie(), tote()], synonyms);

describe("search", () => {
  it("drops filler words so 'the best hoodie for me' is a query, not noise", () => {
    expect(tokenise("The best hoodie for me")).toEqual(["hoodie"]);
    expect(tokenise("Charcoal HOODIE")).toEqual(["charcoal", "hoodie"]);
  });

  it("finds an exact word", () => {
    const response = search(index, "hoodie");
    expect(response.results[0]?.doc.slug).toBe("heavyweight-hoodie");
    expect(response.fallback).toBeNull();
  });

  it("survives a typo instead of dead-ending", () => {
    expect(editDistance("hodie", "hoodie")).toBe(1);
    const response = search(index, "hodie");
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]?.doc.slug).toBe("heavyweight-hoodie");
  });

  it("understands a synonym the catalogue does not use", () => {
    const response = search(index, "jumper");
    expect(response.results.map((result) => result.doc.slug)).toContain("heavyweight-hoodie");
  });

  it("matches a prefix while the shopper is still typing", () => {
    const response = search(index, "hood");
    expect(response.results.length).toBeGreaterThan(0);
    expect(suggest(index, "hood")).toContain("hoodie");
  });

  it("never returns an empty page: it offers a category or the best sellers", () => {
    const nearby = search(index, "hoody", ["Hoodies", "Bags"]);
    expect(nearby.results.length).toBeGreaterThan(0);

    const nothing = search(index, "zzzzqqq", ["Hoodies", "Bags"]);
    expect(nothing.results).toEqual([]);
    expect(nothing.fallback).not.toBeNull();

    const category = search(index, "hoodies", ["Hoodies", "Bags"]);
    expect(category.fallback?.kind === "category" || category.results.length > 0).toBe(true);
  });

  it("flags a correction when it had to stretch", () => {
    const response = search(index, "hodie");
    expect(response.corrected).toBeTruthy();
  });

  it("ranks best sellers above equal matches", () => {
    const plain = { ...hoodie(), bestseller: false };
    const ranked = buildIndex([plain, hoodie()]);
    const response = search(ranked, "hoodie");
    expect(response.results[0]?.doc.id).toBe("p_hoodie");
    expect(response.results).toHaveLength(2);
  });
});
