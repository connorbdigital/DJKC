import { describe, expect, it } from "vitest";
import { buildCodeQuery, explainCodeError, groupByRepo, parseCodeSearch, type RawSearchResponse } from "./codeSearch";

describe("code search query", () => {
  it("scopes to the account when nothing else is chosen", () => {
    expect(buildCodeQuery("STRIPE_SECRET_KEY", { login: "connorbdigital" })).toBe("STRIPE_SECRET_KEY user:connorbdigital");
  });

  it("scopes to one repository when asked", () => {
    expect(buildCodeQuery("deposit", { repo: "connorbdigital/DJKC", login: "connorbdigital" })).toBe(
      "deposit repo:connorbdigital/DJKC"
    );
  });

  it("adds a language qualifier without breaking the rest", () => {
    expect(buildCodeQuery("  theme   colour ", { login: "me", language: "TypeScript" })).toBe(
      "theme colour user:me language:TypeScript"
    );
  });

  it("refuses an empty term or a search with no scope", () => {
    expect(() => buildCodeQuery("   ", { login: "me" })).toThrow(/Type something/);
    expect(() => buildCodeQuery("deposit", {})).toThrow(/scope/);
  });

  it("caps a pasted essay instead of sending it", () => {
    const long = buildCodeQuery("x".repeat(500), { login: "me" });
    expect(long.length).toBeLessThanOrEqual(120 + " user:me".length);
  });
});

describe("code search results", () => {
  const raw: RawSearchResponse = {
    total_count: 2,
    items: [
      {
        repository: { full_name: "connorbdigital/DJKC" },
        path: "api/deposit.ts",
        html_url: "https://github.com/connorbdigital/DJKC/blob/main/api/deposit.ts",
        text_matches: [{ fragment: "const <em>STRIPE_SECRET_KEY</em> = process.env" }, { fragment: "  <em>STRIPE</em>_SECRET_KEY\n" }],
      },
      {
        repository: { full_name: "connorbdigital/Kaysie" },
        path: "src/checkout.ts",
        html_url: "https://github.com/connorbdigital/Kaysie/blob/main/src/checkout.ts",
      },
    ],
  };

  it("strips GitHub's highlight markup and keeps the lines", () => {
    const result = parseCodeSearch(raw, "STRIPE_SECRET_KEY");
    expect(result.matches[0]?.fragments[0]).toBe("const STRIPE_SECRET_KEY = process.env");
    expect(result.matches[0]?.fragments[1]).toBe("STRIPE_SECRET_KEY");
    expect(result.matches[1]?.fragments).toEqual([]);
  });

  it("says when it is showing only part of the answer", () => {
    const result = parseCodeSearch({ ...raw, total_count: 99 }, "STRIPE");
    expect(result.total).toBe(99);
    expect(result.truncated).toBe(true);
    expect(parseCodeSearch(raw, "STRIPE").truncated).toBe(false);
  });

  it("ignores malformed items rather than rendering empty rows", () => {
    const result = parseCodeSearch({ items: [{ repository: {} }, { path: "a.ts" }, raw.items![1]!] }, "x");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.repo).toBe("connorbdigital/Kaysie");
  });

  it("groups by repository, busiest first", () => {
    const result = parseCodeSearch(
      {
        items: [
          { repository: { full_name: "b/two" }, path: "1.ts" },
          { repository: { full_name: "a/one" }, path: "2.ts" },
          { repository: { full_name: "a/one" }, path: "3.ts" },
        ],
      },
      "x"
    );
    expect(groupByRepo(result.matches).map((group) => `${group.repo}:${group.matches.length}`)).toEqual(["a/one:2", "b/two:1"]);
  });

  it("explains a rate limit instead of showing a bare 403", () => {
    expect(explainCodeError("API rate limit exceeded", 403)).toMatch(/ten requests a minute/);
    expect(explainCodeError("Validation Failed", 422)).toMatch(/simpler words/);
    expect(explainCodeError("Bad credentials", 401)).toMatch(/Lock and unlock/);
    expect(explainCodeError("Something else", 500)).toBe("Something else");
  });
});
