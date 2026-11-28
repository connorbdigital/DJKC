import { availability, type Product } from "./catalog";
import { stringifyCsv } from "./csv";
import { toDecimalString } from "./money";

/**
 * Out of the catalogue and into the world.
 *
 * Google Merchant Centre is the strictest of the feed formats, so it is the
 * one written here: if a product survives this, it survives Shopping, and the
 * same rows are close to what Meta and TikTok want. The values are the ones
 * Google actually validates — decimal string plus ISO currency, underscore
 * availability, no HTML in the description.
 */

export const GOOGLE_HEADERS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "brand",
  "condition",
  "gtin",
  "mpn",
  "identifier_exists",
  "google_product_category",
  "product_type",
  "shipping",
] as const;

const plainText = (value: string): string =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const availabilityFor = (product: Product): string => {
  const states = product.variants.map(availability);
  if (states.includes("InStock")) return "in_stock";
  if (states.includes("BackOrder") || states.includes("PreOrder")) return "backorder";
  return "out_of_stock";
};

export interface FeedOptions {
  /** Absolute base for product pages, e.g. https://shop.example */
  linkBase: string;
  /** Shipping line in Google's country:service:price format. */
  shipping?: string;
  googleCategory?: (product: Product) => string | undefined;
}

export interface FeedResult {
  csv: string;
  rows: Record<string, string>[];
  /** Products Google would reject, and why. */
  rejected: { id: string; reason: string }[];
  /**
   * Rows the feed can still write but Merchant Center will complain about.
   * Kept separate from `rejected` because a warning is fixable later without
   * removing the product from Shopping in the meantime.
   */
  warnings: { id: string; reason: string }[];
}

/** Merchant Center takes JPEG, PNG, WebP and GIF. An SVG is a page, not a photo. */
const RECOGNISED_IMAGE = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;

export function googleFeed(products: Product[], options: FeedOptions): FeedResult {
  const rejected: FeedResult["rejected"] = [];
  const warnings: FeedResult["warnings"] = [];
  const rows: Record<string, string>[] = [];

  for (const product of products) {
    const variant = product.variants.find((entry) => availability(entry) !== "OutOfStock") ?? product.variants[0];
    if (!variant) {
      rejected.push({ id: product.id, reason: "no variants" });
      continue;
    }
    if (!product.images.length) {
      rejected.push({ id: product.id, reason: "no image_link (required)" });
      continue;
    }
    if (plainText(product.description).length < 20) {
      rejected.push({ id: product.id, reason: "description too short for a feed" });
      continue;
    }
    if (!RECOGNISED_IMAGE.test(product.images[0]!.url)) {
      warnings.push({
        id: product.id,
        reason: "image_link is not JPEG, PNG, WebP or GIF — Merchant Center will reject this row until real photography replaces the placeholder",
      });
    }
    /* Google needs to be told when a product genuinely has no barcode. Saying
       nothing is read as "forgot", and inventing one attaches the listing to
       somebody else's product. */
    const hasIdentifier = Boolean(variant.gtin || variant.mpn);

    const price = `${toDecimalString(variant.price)} ${variant.price.currency}`;
    const category = options.googleCategory?.(product);

    rows.push({
      id: product.id,
      title: product.title.slice(0, 150),
      description: plainText(product.description).slice(0, 5000),
      link: `${options.linkBase.replace(/\/$/, "")}/product/${product.slug}.html`,
      image_link: product.images[0]!.url,
      availability: availabilityFor(product),
      price,
      brand: product.brand,
      condition: "new",
      gtin: variant.gtin ?? "",
      mpn: variant.mpn ?? "",
      identifier_exists: hasIdentifier ? "yes" : "no",
      google_product_category: category ?? "",
      product_type: product.category,
      shipping: options.shipping ?? "",
    });
  }

  return {
    csv: stringifyCsv(
      [...GOOGLE_HEADERS],
      rows.map((row) => GOOGLE_HEADERS.map((header) => row[header] ?? ""))
    ),
    rows,
    rejected,
    warnings,
  };
}

/** The minimum representation a front end or an app needs. */
export function productsJson(products: Product[], linkBase: string): string {
  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      currency: products[0]?.currency ?? "GBP",
      products: products.map((product) => {
        const variant = product.variants[0];
        return {
          id: product.id,
          slug: product.slug,
          title: product.title,
          brand: product.brand,
          category: product.category,
          url: `${linkBase.replace(/\/$/, "")}/product/${product.slug}.html`,
          price: variant ? toDecimalString(variant.price) : null,
          currency: variant?.price.currency ?? product.currency,
          availability: availabilityFor(product),
          gtin: variant?.gtin ?? null,
          images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
          returnDays: product.returnPolicy.days,
        };
      }),
    },
    null,
    2
  )}\n`;
}

/** sitemap.xml for the catalogue, so the pages are discoverable on day one. */
export function sitemap(urls: string[], lastmod?: string): string {
  const entries = urls
    .map((url) => `  <url><loc>${url}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
