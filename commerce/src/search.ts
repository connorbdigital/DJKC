/**
 * On-site search, treated as a revenue surface rather than a text box.
 *
 * Shoppers who use search convert several times better than browsers, and most
 * leave after one empty result. So this index does three things a plain filter
 * does not: it tolerates a typo, it understands a synonym, and it always has
 * somewhere to send a shopper when nothing matches.
 */
import type { Product } from "./catalog";

export interface SearchDoc {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: string;
  /** Rolled-up text: title, brand, category, attributes, description. */
  text: string;
  tokens: string[];
  bestseller: boolean;
}

export interface Synonym {
  /** What shoppers type. */
  term: string;
  /** What the catalogue calls it. */
  means: string[];
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  /** Which of the shopper's words matched, for "showing results for…". */
  matched: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  /** What to show when nothing matched, instead of a dead end. */
  fallback: { kind: "bestsellers" | "category" | "browse"; category?: string } | null;
  /** A gentle correction: "Showing results for hoodie". */
  corrected: string | null;
}

const STOP = new Set(["a", "an", "and", "the", "for", "with", "in", "of", "to", "my", "me", "best", "cheap"]);

export const tokenise = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOP.has(token));

/** Levenshtein distance, capped: we only care whether it is 0, 1 or more. */
export function editDistance(a: string, b: string, cap = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    let rowMin = previous[0]!;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(
        previous[j]! + 1,
        previous[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
      rowMin = Math.min(rowMin, previous[j]!);
    }
    if (rowMin > cap) return cap + 1;
  }
  return previous[b.length]!;
}

export function buildIndex(products: Product[], synonyms: Synonym[] = []): SearchDoc[] {
  const expanded = (category: string) => {
    const extra = synonyms.filter((entry) => entry.means.some((mean) => category.toLowerCase().includes(mean.toLowerCase())));
    return extra.map((entry) => entry.term).join(" ");
  };

  return products.map((product) => {
    const attributes = Object.entries(product.attributes ?? {})
      .map(([key, value]) => `${key} ${value}`)
      .join(" ");
    const options = product.variants.flatMap((variant) => variant.options.map((option) => option.value)).join(" ");
    const text = [
      product.title,
      product.brand,
      product.category,
      expanded(product.category),
      attributes,
      options,
      product.description,
    ].join(" ");
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      category: product.category,
      text,
      tokens: [...new Set(tokenise(text))],
      bestseller: Boolean(product.bestseller),
    };
  });
}

const scoreToken = (query: string, docTokens: string[]): number => {
  if (docTokens.includes(query)) return 3;
  if (docTokens.some((token) => token.startsWith(query) && query.length >= 3)) return 2;
  /* One transposition or a dropped letter: "hodie" still finds "hoodie". */
  if (query.length >= 5 && docTokens.some((token) => editDistance(query, token, 1) <= 1)) return 1.5;
  return 0;
};

export function search(index: SearchDoc[], rawQuery: string, categories: string[] = []): SearchResponse {
  const queryTokens = tokenise(rawQuery);
  if (!queryTokens.length) {
    return { query: rawQuery, results: [], fallback: { kind: "browse" }, corrected: null };
  }

  const scored: SearchResult[] = [];
  for (const doc of index) {
    let score = 0;
    const matched: string[] = [];
    for (const token of queryTokens) {
      const value = scoreToken(token, doc.tokens);
      if (value > 0) {
        score += value;
        matched.push(token);
      }
    }
    /* Bonuses only lift a real match; a bestseller alone is not a result. */
    if (score > 0) {
      if (modifiedFieldBonus(doc, rawQuery)) score += 1;
      if (doc.bestseller) score += 0.25;
      scored.push({ doc, score, matched });
    }
  }

  const results = scored.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));

  if (results.length) {
    const best = results[0]!;
    const corrected =
      best.matched.length && !queryTokens.every((token) => best.doc.tokens.includes(token)) ? best.doc.title : null;
    return { query: rawQuery, results, fallback: null, corrected };
  }

  /* Nothing matched: offer the nearest category, else the best sellers. */
  const nearest = categories.find((category) =>
    queryTokens.some((token) => category.toLowerCase().includes(token) || editDistance(token, category.toLowerCase(), 2) <= 2)
  );
  const bestsellers = index.filter((doc) => doc.bestseller).slice(0, 8);
  if (nearest) {
    return {
      query: rawQuery,
      results: [],
      fallback: { kind: "category", category: nearest },
      corrected: null,
    };
  }
  return {
    query: rawQuery,
    results: [],
    fallback: bestsellers.length ? { kind: "bestsellers" } : { kind: "browse" },
    corrected: null,
  };
}

function modifiedFieldBonus(doc: SearchDoc, rawQuery: string): boolean {
  const phrase = rawQuery.toLowerCase().replace(/\s+/g, "");
  return phrase.length > 3 && doc.title.toLowerCase().replace(/\s+/g, "").includes(phrase);
}

/** Suggestions for the box while typing — cheap prefix work, no network. */
export function suggest(index: SearchDoc[], prefix: string, limit = 6): string[] {
  const clean = prefix.trim().toLowerCase();
  if (clean.length < 2) return [];
  const seen = new Set<string>();
  for (const doc of index) {
    for (const token of doc.tokens) {
      if (token.startsWith(clean)) seen.add(token);
      if (seen.size >= limit) break;
    }
    if (seen.size >= limit) break;
  }
  return [...seen].slice(0, limit);
}
