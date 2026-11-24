import type { Currency, Money } from "./money";

/**
 * The catalogue model.
 *
 * The fields here are the ones AI shopping agents and Merchant Centre feeds
 * actually read — GTIN, MPN, brand, availability, return policy — because a
 * product page that omits them is skipped before its copy is ever considered.
 */
export interface VariantOption {
  name: string;
  value: string;
}

export interface Variant {
  sku: string;
  /** Shown to the shopper, e.g. "Black / M". */
  title: string;
  options: VariantOption[];
  price: Money;
  /** Was-price, for honest sale badges. Must be higher than price. */
  compareAt?: Money;
  stock: number;
  /** Back-orderable even at zero stock. */
  madeToOrder?: boolean;
  gtin?: string;
  mpn?: string;
  weightGrams?: number;
}

export interface ReturnPolicy {
  days: number;
  /** Free returns? Saying so is worth conversion; lying about it is not. */
  freeReturns: boolean;
  /** "Return for free within 30 days" — human wording, used in schema and UI. */
  summary: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  /** Plain-language description that answers real questions, not keyword soup. */
  description: string;
  brand: string;
  category: string;
  currency: Currency;
  images: { url: string; alt: string }[];
  variants: Variant[];
  returnPolicy: ReturnPolicy;
  /** Extra structured properties for agents and feeds. */
  attributes?: Record<string, string>;
  rating?: { value: number; count: number };
  /** Internal: best sellers survive a zero-result search. */
  bestseller?: boolean;
}

export type Availability = "InStock" | "OutOfStock" | "BackOrder" | "PreOrder";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GTIN = /^\d{8}$|^\d{12,14}$/;
const CURRENCY: Currency[] = ["GBP", "EUR", "USD"];

/** schema.org availability uses full URLs, not the word "InStock". */
export function availability(variant: Variant): Availability {
  if (variant.stock > 0) return "InStock";
  if (variant.madeToOrder) return "BackOrder";
  return "OutOfStock";
}

export const availabilityUrl = (value: Availability): string => `https://schema.org/${value}`;

export interface Issue {
  field: string;
  problem: string;
  /** Why it matters, in the language of money. */
  because: string;
}

/**
 * A product is "complete" when an agent could buy from it without guessing.
 * Deliberately strict: these are the gaps found on most live stores.
 */
export function validateProduct(product: Product): Issue[] {
  const issues: Issue[] = [];
  const has = (value: string | undefined, length = 1) => Boolean(value && value.trim().length >= length);

  if (!SLUG.test(product.slug)) {
    issues.push({ field: "slug", problem: `"${product.slug}" is not a kebab-case slug`, because: "unstable URLs break links, feeds and analytics" });
  }
  if (!has(product.title, 8)) {
    issues.push({ field: "title", problem: "title is missing or too short", because: "the title is the agent's first relevance signal" });
  }
  if (!has(product.description, 80)) {
    issues.push({
      field: "description",
      problem: "description is under 80 characters",
      because: "conversational questions cannot be answered by a one-liner",
    });
  }
  if (!has(product.brand)) {
    issues.push({ field: "brand", problem: "brand is missing", because: "Offer/Brand is required for rich results and Shopping feeds" });
  }
  if (!CURRENCY.includes(product.currency)) {
    issues.push({ field: "currency", problem: `"${product.currency}" is not an ISO 4217 code we support`, because: "offers without a currency are ineligible" });
  }
  if (!product.images.length) {
    issues.push({ field: "images", problem: "no images", because: "the product cannot be shown in results or ads" });
  }
  for (const image of product.images) {
    if (!has(image.alt, 8)) {
      issues.push({ field: `images.alt(${image.url})`, problem: "image alt text is missing or vague", because: "missing alt text is the second most cited accessibility failure in retail" });
    }
  }
  if (!product.variants.length) {
    issues.push({ field: "variants", problem: "no purchasable variant", because: "there is nothing to add to a basket" });
  }

  const skus = new Set<string>();
  for (const variant of product.variants) {
    if (!has(variant.sku)) issues.push({ field: "variant.sku", problem: "variant has no SKU", because: "orders and stock cannot be reconciled" });
    if (skus.has(variant.sku)) issues.push({ field: `variant.sku(${variant.sku})`, problem: "duplicate SKU", because: "two variants will fight over one stock count" });
    skus.add(variant.sku);
    if (variant.price.amount <= 0) {
      issues.push({ field: `variant.price(${variant.sku})`, problem: "price is zero or negative", because: "invalid offers are rejected by feeds" });
    }
    if (variant.price.currency !== product.currency) {
      issues.push({ field: `variant.price(${variant.sku})`, problem: "variant currency differs from the product", because: "a mixed-currency catalogue cannot be priced" });
    }
    if (variant.compareAt && variant.compareAt.amount <= variant.price.amount) {
      issues.push({ field: `variant.compareAt(${variant.sku})`, problem: "compare-at price is not higher than the price", because: "a fake was-price is a pricing-standards problem, not a badge" });
    }
    if (variant.stock < 0) issues.push({ field: `variant.stock(${variant.sku})`, problem: "stock is negative", because: "availability will be wrong in every feed" });
    if (variant.gtin && !GTIN.test(variant.gtin)) {
      issues.push({ field: `variant.gtin(${variant.sku})`, problem: "GTIN is not 8, 12, 13 or 14 digits", because: "malformed identifiers get the product demoted" });
    }
    if (!variant.gtin && !variant.mpn) {
      issues.push({
        field: `variant.identity(${variant.sku})`,
        problem: "neither GTIN nor MPN is set",
        because: "without a global identifier, agents treat the product as ambiguous",
      });
    }
  }

  if (product.returnPolicy.days < 14) {
    issues.push({
      field: "returnPolicy.days",
      problem: `returns window is ${product.returnPolicy.days} days`,
      because: "UK distance selling gives 14 days by law; less is unenforceable",
    });
  }
  if (product.rating && (product.rating.value < 0 || product.rating.value > 5 || product.rating.count < 1)) {
    issues.push({ field: "rating", problem: "rating is out of range or has no reviews", because: "fabricated review data is both a legal and an agent-trust problem" });
  }

  return issues;
}

export const isComplete = (product: Product): boolean => validateProduct(product).length === 0;

export const variantsInStock = (product: Product): Variant[] =>
  product.variants.filter((variant) => availability(variant) !== "OutOfStock");

/** Lowest purchasable price — "from £19" needs the variant that can be bought. */
export function priceFrom(product: Product): Money | null {
  const candidates = variantsInStock(product);
  if (!candidates.length) return null;
  return candidates.reduce((lowest, variant) => (variant.price.amount < lowest.amount ? variant.price : lowest), candidates[0]!.price);
}

export const variantBySku = (products: Product[], sku: string): { product: Product; variant: Variant } | null => {
  for (const product of products) {
    const variant = product.variants.find((entry) => entry.sku === sku);
    if (variant) return { product, variant };
  }
  return null;
};
