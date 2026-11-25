/**
 * The money, in one place.
 *
 * Two rules decide everything here:
 *
 * 1. **The server prices the basket.** The browser sends ids and quantities, and
 *    nothing else. A price that arrives from a browser is a price a browser can
 *    change.
 * 2. **Delivery is a rule, not a sentence.** "Free over £40" is arithmetic, and it
 *    has to be the same arithmetic in the basket, in the payment session and in
 *    whatever the customer is told.
 */

export const DELIVERY = { freeOver: 4000, standard: 395, express: 595, expressInDays: [1, 2] };

const minor = (value) => Math.round(Number(String(value).replace(/[^0-9.]/g, "")) * 100) || 0;
const quantity = (value) => Math.max(1, Math.min(10, Number.parseInt(String(value), 10) || 1));

/** What a basket asks for, made safe: ids and small integers, nothing else. */
export function requestedLines(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const entry of items) {
    const id = typeof entry?.id === "string" ? entry.id.trim().slice(0, 64) : "";
    if (!id) continue;
    merged.set(id, Math.min(10, (merged.get(id) ?? 0) + quantity(entry?.qty)));
  }
  return [...merged.entries()].map(([id, qty]) => ({ id, qty }));
}

/**
 * A basket, priced against the server's own catalogue.
 *
 * `catalogue` is generated at build time from `products.csv`, so the shop and the
 * checkout cannot disagree about what a mug costs — they are reading the same file
 * through two different doors.
 */
export function priceBasket(catalogue, items, delivery = DELIVERY) {
  const byId = new Map(catalogue.map((product) => [product.id, product]));
  const lines = [];
  const problems = [];

  for (const wanted of requestedLines(items)) {
    const product = byId.get(wanted.id);
    if (!product) {
      problems.push(`${wanted.id} is not in the catalogue.`);
      continue;
    }
    if (!product.available) {
      problems.push(`${product.name} is out of stock.`);
      continue;
    }
    const unitMinor = product.priceMinor;
    lines.push({
      id: product.id,
      name: product.name,
      image: product.image,
      unitMinor,
      qty: wanted.qty,
      lineMinor: unitMinor * wanted.qty,
    });
  }

  if (!lines.length && !problems.length) problems.push("The basket is empty.");

  const subtotal = lines.reduce((total, line) => total + line.lineMinor, 0);
  const shipping = shippingFor(subtotal, delivery);
  return {
    ok: problems.length === 0,
    problems,
    lines,
    subtotal,
    shipping,
    total: subtotal + (lines.length ? shipping : 0),
    freeOver: delivery.freeOver,
  };
}

/** Free over the threshold, otherwise the standard rate. One rule, both ends. */
export function shippingFor(subtotal, delivery = DELIVERY) {
  if (subtotal <= 0) return 0;
  return subtotal >= delivery.freeOver ? 0 : delivery.standard;
}

const pounds = (value) => `£${(value / 100).toFixed(2)}`;

export const formatMoney = pounds;

/**
 * The Stripe Checkout session, as a form body. Written by hand rather than with
 * the SDK: it is one POST, and a dependency that has to be installed in a static
 * build is a dependency that can break the build.
 *
 * Stripe takes form-encoded nested keys, so `line_items[0][price_data][currency]`
 * is a literal key, not a nested object.
 */
export function sessionBody({ lines, shipping, baseUrl, successPath, cancelPath, delivery = DELIVERY }) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${baseUrl}${cancelPath}`);
  body.set("billing_address_collection", "required");
  body.set("shipping_address_collection[allowed_countries][0]", "GB");
  body.set("locale", "en-GB");
  body.set("metadata[shop]", "Hearth & Grain");

  lines.forEach((line, index) => {
    body.set(`line_items[${index}][quantity]`, String(line.qty));
    body.set(`line_items[${index}][price_data][currency]`, "gbp");
    body.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitMinor));
    body.set(`line_items[${index}][price_data][product_data][name]`, line.name);
    const image = typeof line.image === "string" && /^https:\/\//.test(line.image) ? line.image : "";
    if (image) body.set(`line_items[${index}][price_data][product_data][images][0]`, image);
  });

  /* Delivery is its own line, so the customer can see the £0.00 and believe it. */
  const shippingIndex = lines.length;
  body.set(`line_items[${shippingIndex}][quantity]`, "1");
  body.set(`line_items[${shippingIndex}][price_data][currency]`, "gbp");
  body.set(`line_items[${shippingIndex}][price_data][unit_amount]`, String(shipping));
  body.set(
    `line_items[${shippingIndex}][price_data][product_data][name]`,
    shipping === 0 ? `Delivery — free over ${pounds(delivery.freeOver)}` : "Standard delivery (2–3 working days)"
  );
  return body;
}

/** A sentence for the shop's basket, so the number is never a surprise. */
export function basketNote(priced) {
  if (!priced.lines.length) return "The basket is empty.";
  if (priced.shipping === 0) return `Free delivery — the order is over ${pounds(priced.freeOver)}.`;
  const short = priced.freeOver - priced.subtotal;
  return `${pounds(priced.shipping)} standard delivery. ${pounds(short)} more and it is free.`;
}
