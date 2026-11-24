import type { Currency } from "./money";
import type { Product, Variant } from "./catalog";
import { parseCsv, valueFor, type Row } from "./csv";

/**
 * Turning a supplier's spreadsheet into this framework's catalogue.
 *
 * Suppliers name the same six facts six different ways. Rather than one rigid
 * template, each known feed has a column map, and anything unrecognised falls
 * back to the generic map. Every row that cannot become a valid product is
 * reported with the row number and the reason — silently dropping rows is how
 * a shop ends up with 40 of 200 products and no idea why.
 */

export type ProfileId = "aosom" | "shopify" | "google" | "generic";

export const FIELDS = [
  "id",
  "title",
  "description",
  "brand",
  "category",
  "price",
  "compareAt",
  "stock",
  "availability",
  "sku",
  "image",
  "altText",
  "gtin",
  "mpn",
  "slug",
  "returnDays",
] as const;

export type Field = (typeof FIELDS)[number];

export interface ImportProfile {
  id: ProfileId;
  label: string;
  /** What this profile is usually a sign of. */
  hint: string;
  columns: Record<Field, string[]>;
}

const GENERIC: ImportProfile = {
  id: "generic",
  label: "Generic product CSV",
  hint: "id/sku, name, description, price, stock, image, brand, category",
  columns: {
    id: ["id", "product id", "product_id", "item id"],
    title: ["title", "name", "product name", "product title", "description short"],
    description: ["description", "long description", "details", "body"],
    brand: ["brand", "manufacturer", "vendor", "supplier"],
    category: ["category", "categories", "product type", "type", "department"],
    price: ["price", "unit price", "sell price", "rsp", "rrp"],
    compareAt: ["compare at", "compare_at_price", "was price", "list price", "msrp"],
    stock: ["stock", "quantity", "qty", "inventory", "stock level"],
    availability: ["availability", "stock status", "status"],
    sku: ["sku", "sku code", "product code", "code", "item number"],
    image: ["image", "image url", "image_link", "images", "photo", "picture"],
    altText: ["alt", "image alt", "alt text", "image alt text"],
    gtin: ["gtin", "ean", "barcode", "upc", "ean13"],
    mpn: ["mpn", "manufacturer part number", "model"],
    slug: ["slug", "handle", "url key", "url"],
    returnDays: ["return days", "returns window", "return period"],
  },
};

/**
 * Aosom's dropship feed is a trade document: numeric product IDs, a name, a
 * long description, RRP-style pricing, stock as a number, and one image URL.
 * Their B2B portal exposes a live data feed once an account exists, so the
 * column names vary a little between accounts — hence several candidates.
 */
const AOSOM: ImportProfile = {
  id: "aosom",
  label: "Aosom / trade drop-ship",
  hint: "product id, name, description, RRP, stock, image, category path",
  columns: {
    ...GENERIC.columns,
    id: ["product id", "id", "item number", "aosom id"],
    title: ["product name", "name", "title"],
    description: ["product description", "description", "long description", "features"],
    brand: ["brand", "manufacturer", "supplier"],
    category: ["category", "category name", "product type", "department"],
    price: ["rrp", "price", "retail price", "sell price"],
    compareAt: ["compare at", "compare at price", "list price", "was price"],
    stock: ["stock", "quantity available", "qty", "stock level"],
    availability: ["stock status", "availability", "status"],
    sku: ["sku", "sku code", "manufacturer part number", "mpn"],
    image: ["image url", "image", "main image", "image link"],
  },
};

const SHOPIFY: ImportProfile = {
  id: "shopify",
  label: "Shopify product export",
  hint: "Handle, Title, Body (HTML), Variant Price, Variant SKU, Image Src",
  columns: {
    ...GENERIC.columns,
    id: ["handle", "id"],
    title: ["title"],
    description: ["body html", "body (html)", "description"],
    brand: ["vendor", "brand"],
    category: ["product category", "type", "tags"],
    price: ["variant price"],
    compareAt: ["variant compare at price"],
    stock: ["variant inventory qty", "inventory qty"],
    availability: ["variant inventory management", "status", "published"],
    sku: ["variant sku"],
    image: ["image src", "variant image"],
    altText: ["image alt text"],
    gtin: ["variant barcode"],
    slug: ["handle"],
  },
};

const GOOGLE: ImportProfile = {
  id: "google",
  label: "Google Merchant feed",
  hint: "id, title, description, link, image_link, availability, price, brand",
  columns: {
    ...GENERIC.columns,
    id: ["id"],
    title: ["title"],
    description: ["description"],
    brand: ["brand"],
    category: ["google product category", "product type"],
    price: ["price"],
    stock: ["quantity", "stock"],
    availability: ["availability"],
    sku: ["mpn", "id"],
    image: ["image link", "image_link"],
    gtin: ["gtin"],
    slug: ["link"],
  },
};

export const PROFILES: ImportProfile[] = [GENERIC, AOSOM, SHOPIFY, GOOGLE];

export const profileById = (id: ProfileId): ImportProfile => PROFILES.find((profile) => profile.id === id) ?? GENERIC;

/** Which profile a header row looks most like, with the evidence. */
export function detectProfile(headers: string[]): { profile?: ImportProfile; best: { id: ProfileId; matched: number }[] } {
  const normalised = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const scores = PROFILES.map((profile) => {
    const wanted = Object.values(profile.columns).flat().map((column) => column.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const matched = normalised.filter((header) => wanted.includes(header)).length;
    return { id: profile.id, matched };
  }).sort((a, b) => b.matched - a.matched || Number(a.id === "generic") - Number(b.id === "generic"));
  const best = scores[0];
  const distinctive = best && best.matched >= 4 ? PROFILE_BY_ID[best.id] : undefined;
  return { profile: distinctive, best: scores };
}

const PROFILE_BY_ID: Record<ProfileId, ImportProfile> = {
  generic: GENERIC,
  aosom: AOSOM,
  shopify: SHOPIFY,
  google: GOOGLE,
};

/** Columns that become the "key facts" table rather than the description. */
export const SPEC_COLUMNS: { label: string; candidates: string[] }[] = [
  { label: "Material", candidates: ["material", "materials", "fabric", "composition"] },
  { label: "Dimensions", candidates: ["dimensions", "size (cm)", "size", "measurements", "dimensions (cm)"] },
  { label: "Weight", candidates: ["weight", "item weight", "product weight"] },
  { label: "Colour", candidates: ["colour", "color"] },
  { label: "Care", candidates: ["care", "care instructions", "washing instructions"] },
  { label: "Power", candidates: ["power", "battery", "wattage", "voltage"] },
  { label: "Includes", candidates: ["includes", "what's included", "contents", "pack contents"] },
];

const CURRENCY_TOKENS: Record<string, Currency> = { GBP: "GBP", "£": "GBP", EUR: "EUR", "€": "EUR", USD: "USD", $: "USD" };

/** "£1,299.00", "1299.00 GBP", "1299" → 129900 minor units. */
export function parsePrice(raw: string, fallback: Currency): { amount: number; currency: Currency } | null {
  const text = raw.replace(/\s/g, "");
  if (!text || text.startsWith("-")) return null;
  let currency = fallback;
  for (const [token, code] of Object.entries(CURRENCY_TOKENS)) {
    if (text.toUpperCase().includes(token)) currency = code;
  }
  const numeric = text.replace(/[^0-9.,]/g, "");
  if (!numeric) return null;
  /* 1.299,00 (European) vs 1,299.00 (British). Whichever separator is last is the decimal. */
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  let normalised: string;
  if (lastComma > lastDot && lastComma !== -1 && lastDot === -1 && numeric.length - lastComma - 1 === 3) {
    /* "1,050" with no dot is a thousands separator, not 1.05. */
    normalised = numeric.replace(/,/g, "");
  } else if (lastComma > lastDot && lastComma !== -1) {
    normalised = numeric.replace(/\./g, "").replace(",", ".");
  } else {
    normalised = numeric.replace(/,/g, "");
  }
  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value) || value < 0) return null;
  return { amount: Math.round(value * 100), currency };
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);

const imagesFrom = (raw: string): { url: string; alt: string }[] =>
  raw
    .split(/[,;|]/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt: "" }));

const stockFrom = (row: Row, profile: ImportProfile): { stock: number; madeToOrder: boolean } => {
  const raw = valueFor(row, profile.columns.stock);
  const availability = valueFor(row, profile.columns.availability).toLowerCase();
  const numeric = Number.parseInt(raw.replace(/[^0-9-]/g, ""), 10);
  if (Number.isFinite(numeric) && raw.match(/\d/)) return { stock: Math.max(0, numeric), madeToOrder: false };
  if (/(in stock|instock|available|yes|true|1)/.test(availability) || /(in stock|instock|available)/.test(raw.toLowerCase())) {
    return { stock: 1, madeToOrder: false };
  }
  if (/(preorder|pre-order|backorder|back-order|out of stock|outofstock|no|false|0)/.test(availability)) {
    return { stock: 0, madeToOrder: /backorder|back-order/.test(availability) };
  }
  return { stock: 0, madeToOrder: false };
};

export interface ImportIssue {
  row: number;
  sku: string;
  problem: string;
  /** What the importer did about it. */
  action: "skipped" | "repaired";
}

export interface ImportResult {
  products: Product[];
  issues: ImportIssue[];
  profile: ImportProfile;
  stats: { rows: number; imported: number; skipped: number; repaired: number; ragged: number };
}

export interface ImportOptions {
  profile?: ImportProfile;
  defaultBrand?: string;
  currency?: Currency;
  /** Where product pages will live, used to build a title when one is missing. */
  linkBase?: string;
  returnDays?: number;
  returnSummary?: string;
}

export function importCsv(text: string, options: ImportOptions = {}): ImportResult {
  const table = parseCsv(text);
  const profile = options.profile ?? detectProfile(table.headers).profile ?? GENERIC;
  const currency = options.currency ?? "GBP";
  const issues: ImportIssue[] = [];
  const products: Product[] = [];
  const usedSlugs = new Set<string>();

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is line 1
    const title = valueFor(row, profile.columns.title);
    const sku = valueFor(row, profile.columns.sku) || valueFor(row, profile.columns.id);
    const priceRaw = valueFor(row, profile.columns.price);
    const price = parsePrice(priceRaw, currency);

    if (!title) {
      issues.push({ row: rowNumber, sku, problem: "no title", action: "skipped" });
      return;
    }
    if (!price || price.amount === 0) {
      issues.push({ row: rowNumber, sku, problem: `price "${priceRaw}" could not be read as a number`, action: "skipped" });
      return;
    }

    const images = imagesFrom(valueFor(row, profile.columns.image));
    const altText = valueFor(row, profile.columns.altText);
    if (!images.length) {
      issues.push({ row: rowNumber, sku, problem: "no usable image URL", action: "repaired" });
    }
    for (const image of images) {
      image.alt = altText || `${title} — product photograph`;
    }

    let slug = slugify(valueFor(row, profile.columns.slug) || title);
    if (!slug) slug = slugify(sku) || `product-${rowNumber}`;
    if (usedSlugs.has(slug)) {
      let suffix = 2;
      while (usedSlugs.has(`${slug}-${suffix}`)) suffix += 1;
      issues.push({ row: rowNumber, sku, problem: `duplicate slug "${slug}"`, action: "repaired" });
      slug = `${slug}-${suffix}`;
    }
    usedSlugs.add(slug);

    const { stock, madeToOrder } = stockFrom(row, profile);
    const compareRaw = valueFor(row, profile.columns.compareAt);
    const compareAt = compareRaw ? parsePrice(compareRaw, price.currency) : null;
    const gtin = valueFor(row, profile.columns.gtin).replace(/\D/g, "");
    const mpn = valueFor(row, profile.columns.mpn);
    const returnDays = Number.parseInt(valueFor(row, profile.columns.returnDays), 10);

    const variant: Variant = {
      sku: sku || `SKU-${rowNumber}`,
      title: valueFor(row, ["variant title", "option1 value", "size", "colour", "color"]),
      options: [
        valueFor(row, ["colour", "color"]) ? { name: "Colour", value: valueFor(row, ["colour", "color"]) } : null,
        valueFor(row, ["size"]) ? { name: "Size", value: valueFor(row, ["size"]) } : null,
      ].filter((option): option is { name: string; value: string } => Boolean(option)),
      price: { amount: price.amount, currency: price.currency },
      ...(compareAt && compareAt.amount > price.amount ? { compareAt: { amount: compareAt.amount, currency: compareAt.currency } } : {}),
      stock,
      ...(madeToOrder ? { madeToOrder: true } : {}),
      ...(gtin.length >= 8 ? { gtin } : {}),
      ...(mpn ? { mpn } : {}),
    };
    if (!variant.gtin && !variant.mpn) {
      issues.push({ row: rowNumber, sku: variant.sku, problem: "no GTIN or MPN — agents cannot identify it", action: "repaired" });
    }

    const days = Number.isFinite(returnDays) && returnDays > 0 ? returnDays : (options.returnDays ?? 30);

    const specs: Record<string, string> = {};
    for (const column of SPEC_COLUMNS) {
      const value = valueFor(row, column.candidates);
      if (value) specs[column.label] = value;
    }

    products.push({
      id: valueFor(row, profile.columns.id) || variant.sku,
      slug,
      title,
      description: valueFor(row, profile.columns.description) || `${title}.`,
      brand: valueFor(row, profile.columns.brand) || options.defaultBrand || "Unbranded",
      category: (valueFor(row, profile.columns.category).split(/[>|/]/)[0] ?? "General").trim() || "General",
      currency: variant.price.currency,
      images,
      ...(Object.keys(specs).length ? { specs } : {}),
      variants: [variant],
      returnPolicy: {
        days,
        freeReturns: true,
        summary: options.returnSummary ?? `Free returns within ${days} days.`,
      },
    });
  });

  const skipped = issues.filter((issue) => issue.action === "skipped").length;
  return {
    products,
    issues,
    profile,
    stats: {
      rows: table.rows.length,
      imported: products.length,
      skipped,
      repaired: issues.filter((issue) => issue.action === "repaired").length,
      ragged: table.ragged,
    },
  };
}

/** The reason a supplier file usually needs editing before it ships. */
export const IMPORT_CHECKS = [
  "Prices are usually trade prices, not retail: set your own margin before publishing.",
  "Most trade feeds give no GTIN, so agents cannot match the product — add one when you have it.",
  "Stock is a snapshot. A CSV cannot keep a shop in stock; you need the supplier's stock feed or API.",
  "Image rights are the supplier's, not yours: confirm the licence covers your own domain.",
  "VAT: UK retail prices include it. If the feed gives net trade prices, add 20% before you show a price.",
  "GPSR/EPR: since 2024 the EU wants a manufacturer or responsible person named on the listing.",
] as const;
