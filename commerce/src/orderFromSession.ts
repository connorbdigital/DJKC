/**
 * From a Stripe session to an order we can hand to somebody.
 *
 * The webhook is the first moment the shop knows a basket really happened, so
 * this is where the order is built — from the session, not from the browser.
 * Three things are re-derived rather than trusted:
 *
 *  - **which products**, from the compact `cart` the checkout put in the
 *    session metadata (ids and quantities only, which is all that fits: Stripe
 *    allows 500 characters per metadata value);
 *  - **what they cost**, from the catalogue in the repository, because a price
 *    that came from a browser is a price a browser can change;
 *  - **what was paid**, from `amount_total`, and if that disagrees with the
 *    basket the order is refused rather than guessed at. A silent disagreement
 *    here is the difference between a shop and a hole in the accounts.
 */
import { newOrder, type Order, type OrderAddress, type OrderLine } from "./orders.js";

export interface CatalogueEntry {
  id: string;
  sku: string;
  name: string;
  priceMinor: number;
}

export interface CartLine {
  id: string;
  qty: number;
}

export type BuildResult = { ok: true; order: Order } | { ok: false; problems: string[] };

/** Stripe's limit is 500 characters for a metadata value. */
export const CART_METADATA_LIMIT = 500;

/**
 * The smallest thing that can rebuild the basket: product ids and quantities.
 * `HG-1001x1,HG-1004x2` is 10 characters a line, so a normal basket fits with
 * room to spare and a wholesale-sized one is caught before Stripe rejects it.
 */
export function encodeCart(cart: CartLine[]): string {
  return cart.map((line) => `${line.id}x${line.qty}`).join(",");
}

export function decodeCart(value: unknown): CartLine[] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const lines: CartLine[] = [];
  for (const part of value.split(",")) {
    const match = /^([A-Za-z0-9_.:-]{1,64})x([1-9]\d{0,2})$/.exec(part.trim());
    if (!match) return null;
    lines.push({ id: match[1]!, qty: Number(match[2]) });
  }
  return lines.length ? lines : null;
}

const addressFrom = (session: Record<string, unknown>): OrderAddress | null => {
  /* Stripe moved this from `shipping_details` to `collected_information` in 2025;
     an older endpoint version still sends the first, so both are read. */
  const collected = (session.collected_information as Record<string, unknown> | undefined)?.shipping_details;
  const details = (collected ?? session.shipping_details) as Record<string, unknown> | undefined;
  const address = details?.address as Record<string, unknown> | undefined;
  const customer = (session.customer_details as Record<string, unknown> | undefined) ?? {};
  const name = details?.name ?? customer.name;
  if (!address || typeof address.line1 !== "string" || typeof address.postcode !== "string") return null;
  const email = typeof customer.email === "string" ? customer.email : "";
  if (!email) return null;
  return {
    name: typeof name === "string" && name ? name : "A customer",
    line1: address.line1,
    ...(typeof address.line2 === "string" && address.line2 ? { line2: address.line2 } : {}),
    town: typeof address.city === "string" ? address.city : "",
    postcode: address.postcode,
    country: typeof address.country === "string" ? address.country : "GB",
    email,
    ...(typeof customer.phone === "string" && customer.phone ? { phone: customer.phone } : {}),
  };
};

export function buildOrderFromSession(input: {
  session: Record<string, unknown>;
  catalogue: CatalogueEntry[];
  supplier: string;
  at: number;
  /** The imported supplier file replaces our SKU with theirs. */
  supplierSkuFor?: (product: CatalogueEntry) => string | undefined;
}): BuildResult {
  const problems: string[] = [];
  const sessionId = typeof input.session.id === "string" ? input.session.id : "";
  if (!sessionId) problems.push("The session has no id.");

  const metadata = (input.session.metadata as Record<string, unknown> | undefined) ?? {};
  const cart = decodeCart(metadata.cart);
  if (!cart) problems.push("The session carries no readable cart, so the lines cannot be rebuilt.");
  if (!cart) return { ok: false, problems };

  const byId = new Map(input.catalogue.map((product) => [product.id, product]));
  const lines: OrderLine[] = [];
  for (const wanted of cart) {
    const product = byId.get(wanted.id);
    if (!product) {
      problems.push(`${wanted.id} was sold but is no longer in the catalogue.`);
      continue;
    }
    const supplierSku = input.supplierSkuFor?.(product) ?? product.sku;
    lines.push({
      id: product.id,
      supplierSku,
      title: product.name,
      quantity: wanted.qty,
      unitMinor: product.priceMinor,
    });
  }

  const address = addressFrom(input.session);
  if (!address) problems.push("The session has no delivery address or email to send a parcel to.");
  if (problems.length) return { ok: false, problems };

  const goods = lines.reduce((total, line) => total + line.unitMinor * line.quantity, 0);
  const paid = typeof input.session.amount_total === "number" ? input.session.amount_total : null;
  if (paid === null) return { ok: false, problems: ["The session does not say what was paid."] };
  const shippingMinor = paid - goods;
  if (shippingMinor < 0) {
    return { ok: false, problems: [`The customer paid ${paid} for ${goods} of goods, which cannot be right.`] };
  }

  return {
    ok: true,
    order: newOrder({
      id: `ord_${sessionId}`,
      at: input.at,
      lines,
      shippingMinor,
      address: address!,
      supplier: input.supplier,
    }),
  };
}
