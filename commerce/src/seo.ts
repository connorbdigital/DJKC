/**
 * Structured data, written once and reused by every surface.
 *
 * AI shopping agents and Merchant Centre read the same properties, and they
 * read them before any prose. A product without a complete Offer, identifiers
 * and a return policy is skipped. Everything in this module is schema.org
 * valid and free of undefined keys, so it can be serialised straight into a
 * <script type="application/ld+json">.
 */
import { availabilityUrl, availability, type Product, type Variant } from "./catalog";
import { toDecimalString, type Currency } from "./money";

export interface JsonLd {
  [key: string]: unknown;
}

export interface ProductLdOptions {
  /** Canonical product URL, absolute. */
  url: string;
  /** Absolute image base; images must be crawlable. */
  siteName: string;
  /** Return policy window in days; falls back to the product's own. */
  returnDays?: number;
  /** Set false to publish a variant out of stock rather than omit it. */
  includeOutOfStock?: boolean;
}

const clean = (value: { [key: string]: unknown }): JsonLd =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));

export function productJsonLd(product: Product, variant: Variant, options: ProductLdOptions): JsonLd {
  const state = availability(variant);
  const returnDays = options.returnDays ?? product.returnPolicy.days;
  const currency: Currency = product.currency;

  const offer = clean({
    "@type": "Offer",
    url: options.url,
    price: toDecimalString(variant.price),
    priceCurrency: currency,
    availability: availabilityUrl(state),
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: options.siteName },
    priceValidUntil: undefined,
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: "0.00", currency },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "GB",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: returnDays,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: product.returnPolicy.freeReturns ? "https://schema.org/FreeReturn" : "https://schema.org/ReturnShippingFees",
    },
  });

  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: variant.sku,
    brand: { "@type": "Brand", name: product.brand },
    category: product.category,
    image: product.images.map((image) => image.url),
    url: options.url,
    offers: offer,
  };

  if (variant.gtin) data.gtin13 = variant.gtin;
  if (variant.mpn) data.mpn = variant.mpn;
  if (variant.weightGrams) {
    data.weight = { "@type": "QuantitativeValue", value: variant.weightGrams, unitCode: "GRM" };
  }
  if (product.attributes) data.additionalProperty = Object.entries(product.attributes).map(([name, value]) => ({
    "@type": "PropertyValue",
    name,
    value,
  }));
  if (product.rating && product.rating.count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.value.toFixed(1),
      reviewCount: product.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return data;
}

export function breadcrumbJsonLd(trail: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/** FAQ pages earn answer-box and AI-answer visibility, and cost nothing extra. */
export function faqJsonLd(entries: FaqEntry[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/**
 * llms.txt: a plain-text map for answer engines. Cheaper than hoping a crawler
 * works out the site from JavaScript, and it states the prices and policies
 * that must not be paraphrased wrongly.
 */
export function llmsTxt(site: {
  name: string;
  url: string;
  summary: string;
  currency: Currency;
  facts: string[];
  products: { title: string; url: string; price: string }[];
  policies: { returns: string; delivery: string; contact: string };
}): string {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.summary}`,
    "",
    `Canonical: ${site.url}`,
    `Prices are in ${site.currency} and include VAT.`,
    "",
    "## Facts",
    ...site.facts.map((fact) => `- ${fact}`),
    "",
    "## Products",
    ...site.products.map((product) => `- [${product.title}](${product.url}) — ${product.price}`),
    "",
    "## Policies",
    `- Returns: ${site.policies.returns}`,
    `- Delivery: ${site.policies.delivery}`,
    `- Contact: ${site.policies.contact}`,
    "",
  ];
  return lines.join("\n");
}

/** Every product page needs a title and description a shopper would click. */
export function pageMeta(product: Product, price: string): { title: string; description: string } {
  const title = `${product.title} — ${product.brand}`;
  const description = `${product.brand} ${product.title}. ${price} including VAT. ${product.returnPolicy.summary} ${
    product.description.split(/(?<=\.)\s/)[0] ?? ""
  }`.trim();
  return { title: title.slice(0, 60), description: description.slice(0, 155) };
}
