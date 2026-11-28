/**
 * Prodigi, as an adapter — the first supplier the shop can actually buy from.
 *
 * Prodigi prints to order, so there is no stock file, no warehouse split and no
 * oversell: a piece only exists once somebody has paid for it. That makes it the
 * right supplier to prove the chain with, and the wrong one to build a business
 * on, because the margins are thin.
 *
 * Written against the v4 print API with `fetch` injected, so it is testable
 * without a key. Point `baseUrl` at `https://api.sandbox.prodigi.com/v4.0` and
 * the same code places sandbox orders that print nothing and cost nothing.
 *
 * The one thing it cannot do for you is know what to print. A Prodigi order is a
 * SKU plus a print-ready image, and neither is in the basket — so the mapping is
 * configuration (`PRODIGI_ITEMS`), and an unmapped product is refused by name
 * rather than sent as a guess.
 *
 * Endpoints:
 *
 *  - `POST /Quotes` — price a basket for a destination country
 *  - `POST /Orders` — place it; `merchantReference` and `idempotencyKey` both
 *    carry our order id, so a retry returns the first order instead of printing twice
 *  - `GET  /Orders/{id}` — status and shipments, for tracking
 *  - callbacks — status changes, when a callback URL is configured
 */
import type { OrderAddress, OrderEvent, SupplierAdapter } from "../orders.js";

export interface ProdigiItem {
  /** Prodigi's own product SKU, e.g. `GLOBAL-CAN-16X20`. */
  sku: string;
  /** Public https URL of the print-ready file. Not the shop's SVG placeholder. */
  asset: string;
}

export interface ProdigiOptions {
  apiKey: string;
  /** `https://api.sandbox.prodigi.com/v4.0` while building. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /**
   * The SKU the order line carries → what Prodigi needs to make it. Keyed by
   * `line.supplierSku`, which is the shop's own SKU (`HG-1001` → `HG-SHELF-01`)
   * until an imported supplier file replaces it with Prodigi's.
   */
  items: Record<string, ProdigiItem>;
  /** Budget is cheapest and slowest; Overnight is neither. */
  shippingMethod?: "Budget" | "Standard" | "Express" | "Overnight";
  timeoutMs?: number;
}

const DEFAULT_BASE = "https://api.prodigi.com/v4.0";
const PRINTABLE = /\.(png|jpe?g|webp|tiff?)(\?|#|$)/i;

/** `"4.90"` or `4.9` → 490. Prodigi quotes as decimal strings. */
export function toMinor(value: unknown): number | null {
  if (typeof value !== "number") {
    const digits = String(value ?? "").replace(/[^0-9.]/g, "");
    if (!digits) return null;
    value = Number(digits);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export interface ProdigiStatus {
  stage: "InProgress" | "Complete" | "Cancelled";
  shipments: { carrier: string; number: string; url?: string }[];
}

/** The order's stage and whatever has been posted, from either API shape. */
export function readStatus(payload: unknown): ProdigiStatus | null {
  const root = payload as Record<string, unknown> | null;
  const order = ((root?.data as Record<string, unknown> | undefined)?.order ?? root?.order ?? root) as
    | Record<string, unknown>
    | undefined;
  if (!order) return null;
  const status = order.status as { stage?: unknown } | undefined;
  const stage = status?.stage;
  if (stage !== "InProgress" && stage !== "Complete" && stage !== "Cancelled") return null;

  const shipments: ProdigiStatus["shipments"] = [];
  const raw = order.shipments;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const shipment = entry as { tracking?: { number?: unknown; url?: unknown; carrier?: { name?: unknown } } };
      const number = shipment.tracking?.number;
      if (typeof number !== "string" || !number) continue;
      const carrier = shipment.tracking?.carrier?.name;
      shipments.push({
        carrier: typeof carrier === "string" ? carrier : "the carrier",
        number,
        ...(typeof shipment.tracking?.url === "string" ? { url: shipment.tracking.url } : {}),
      });
    }
  }
  return { stage, shipments };
}

export interface ProdigiAdapter extends SupplierAdapter {
  /** Status and tracking, for the poll that a missed callback needs. */
  tracking(supplierReference: string): Promise<{ ok: true; status: ProdigiStatus } | { ok: false; reason: string }>;
}

export function prodigiAdapter(options: ProdigiOptions): ProdigiAdapter {
  const base = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const shippingMethod = options.shippingMethod ?? "Budget";

  const call = async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; payload: unknown }> => {
    const response = await doFetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "X-API-Key": options.apiKey,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  };

  /** Our basket → Prodigi's `items`, or the reason it cannot be one. */
  const toItems = (lines: { supplierSku: string; quantity: number }[]) => {
    const items: { sku: string; copies: string; assets: { printArea: string; url: string }[] }[] = [];
    for (const line of lines) {
      const mapped = options.items[line.supplierSku];
      if (!mapped) {
        return {
          ok: false as const,
          reason: `No Prodigi product is mapped for ${line.supplierSku}, so nothing can be printed for it.`,
        };
      }
      if (!PRINTABLE.test(mapped.asset)) {
        return {
          ok: false as const,
          reason: `${line.supplierSku} is mapped to ${mapped.asset}, which is not a print-ready PNG, JPEG, WebP or TIFF.`,
        };
      }
      items.push({ sku: mapped.sku, copies: String(line.quantity), assets: [{ printArea: "default", url: mapped.asset }] });
    }
    return { ok: true as const, items };
  };

  return {
    name: "Prodigi",

    async quote(input) {
      const mapped = toItems(input.lines);
      if (!mapped.ok) return { ok: false, reason: mapped.reason };

      const result = await call("/Quotes", {
        shippingMethod,
        destinationCountryCode: input.address.country,
        items: mapped.items,
      });
      if (!result.ok) return { ok: false, reason: `Prodigi answered ${result.status} for a quote.` };

      const quote = (result.payload as { quotes?: { costs?: { shipping?: { amount?: unknown; currency?: unknown } } }[] } | null)?.quotes?.[0];
      const amount = toMinor(quote?.costs?.shipping?.amount);
      const currency = typeof quote?.costs?.shipping?.currency === "string" ? quote.costs.shipping.currency : "GBP";
      if (amount === null) return { ok: false, reason: "Prodigi returned a quote with no shipping cost." };

      /* The delivery window is Prodigi's to promise, not ours to invent: the
         quote does not carry one, so it stays null and the shop says "printed
         to order" rather than a number. */
      return { ok: true, shippingMinor: amount, currency, etaDays: null };
    },

    async place(input) {
      const mapped = toItems(input.lines);
      if (!mapped.ok) return { ok: false, reason: mapped.reason, retryable: false };

      const result = await call("/Orders", {
        merchantReference: input.orderId,
        idempotencyKey: input.orderId,
        shippingMethod,
        recipient: {
          name: input.address.name,
          email: input.address.email,
          ...(input.address.phone ? { phoneNumber: input.address.phone } : {}),
          address: {
            line1: input.address.line1,
            ...(input.address.line2 ? { line2: input.address.line2 } : {}),
            town: input.address.town,
            postcode: input.address.postcode,
            countryCode: input.address.country,
          },
        },
        items: mapped.items,
        metadata: { orderId: input.orderId },
      });

      if (!result.ok) {
        /* 409 with the same idempotency key is the retry that already succeeded. */
        if (result.status === 409) {
          const existing = (result.payload as { order?: { id?: unknown } } | null)?.order?.id;
          if (typeof existing === "string" && existing) return { ok: true, supplierReference: existing };
        }
        return {
          ok: false,
          reason: `Prodigi answered ${result.status}${result.status === 400 ? " (the order is not printable as sent)" : ""}.`,
          retryable: result.status >= 500 || result.status === 429,
        };
      }

      const id = (result.payload as { order?: { id?: unknown } } | null)?.order?.id;
      if (typeof id !== "string" || !id) return { ok: false, reason: "Prodigi accepted the order but returned no id.", retryable: false };
      return { ok: true, supplierReference: id };
    },

    /**
     * Prodigi sends CloudEvents: `{ type, data: { order } }`. The status is read
     * from the stage, and a shipment is what makes something `shipped`.
     */
    parseCallback(payload) {
      const status = readStatus(payload);
      if (!status) return null;
      const at = Date.now();

      if (status.stage === "Cancelled") {
        return { type: "refused", at, reason: "Prodigi cancelled the order", retryable: false };
      }
      if (status.shipments.length) {
        const first = status.shipments[0]!;
        return {
          type: "shipped",
          at,
          carrier: first.carrier,
          trackingNumber: first.number,
          ...(first.url ? { trackingUrl: first.url } : {}),
        };
      }
      if (status.stage === "InProgress") return { type: "accepted", at };
      return { type: "delivered", at };
    },

    async tracking(supplierReference) {
      const result = await call(`/Orders/${encodeURIComponent(supplierReference)}`);
      if (!result.ok) return { ok: false, reason: `Prodigi answered ${result.status} for the order.` };
      const status = readStatus(result.payload);
      if (!status) return { ok: false, reason: "Prodigi returned an order in a shape this adapter does not read." };
      return { ok: true, status };
    },
  };
}

/** Only what Prodigi needs to hear: the address is what a print order ships to. */
export const printableAddress = (address: OrderAddress) => ({
  country: address.country,
  postcode: address.postcode,
});

/** Callbacks as order events, for a poll that has no event to parse. */
export function statusToEvent(status: ProdigiStatus, at: number): OrderEvent | null {
  if (status.stage === "Cancelled") return { type: "refused", at, reason: "Prodigi cancelled the order", retryable: false };
  if (status.shipments.length) {
    const first = status.shipments[0]!;
    return { type: "shipped", at, carrier: first.carrier, trackingNumber: first.number, ...(first.url ? { trackingUrl: first.url } : {}) };
  }
  return null;
}
