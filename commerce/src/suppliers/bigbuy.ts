/**
 * BigBuy, as an adapter.
 *
 * BigBuy is the one supplier on the shortlist with a documented catalogue *and*
 * order API, a sandbox to build against, and per-postcode carrier pricing. What
 * it does not have is a webhook: tracking is polled. And what it prices in is
 * euros, while this shop sells in pounds — which is the single thing that has to
 * be decided before it can be switched on, and the reason `quote` refuses by
 * default rather than converting at a rate nobody chose.
 *
 * Written against <https://api.bigbuy.eu/rest/doc> and the published user guide,
 * with `fetch` injected so the whole thing can be tested without a key, a
 * network, or an account.
 *
 * Endpoints used:
 *
 *  - `POST /rest/shipping/orders.json` — carriers and prices for a real postcode
 *  - `POST /rest/order/check/multishipping.json` — validate, and price, without ordering
 *  - `POST /rest/order/create/multishipping.json` — place it; one order per warehouse
 *  - `GET  /rest/tracking/order/{id}.json` — where it got to
 */
import type { OrderAddress, OrderEvent, SupplierAdapter } from "../orders.js";

export interface BigBuyOptions {
  apiKey: string;
  /** `https://api.sandbox.bigbuy.eu` while building; production otherwise. */
  baseUrl?: string;
  /** Injected in tests; defaults to the global. */
  fetch?: typeof fetch;
  /** BigBuy's own catalogue language, not the customer's. */
  language?: string;
  /** How BigBuy bills the trade account: `moneybox` is the balance model. */
  paymentMethod?: string;
  /** Carrier names to offer, in preference order. Empty means "let BigBuy choose". */
  carriers?: string[];
  /**
   * BigBuy quotes in EUR. Without a rate the adapter refuses to quote at all,
   * because a shipping price invented by this module would be a promise the shop
   * cannot keep.
   */
  toShopCurrency?: (eurMinor: number) => number;
  timeoutMs?: number;
}

export interface BigBuyTracking {
  carrier: string | null;
  number: string | null;
  /** Everything BigBuy returned, for the order history. */
  raw: unknown;
}

const DEFAULT_BASE = "https://api.bigbuy.eu";

/** `"4-6 days"` → `[4, 6]`; anything unreadable → null rather than a guess. */
export function parseDelay(delay: unknown): [number, number] | null {
  if (typeof delay !== "string") return null;
  const numbers = delay.match(/\d+/g)?.map(Number);
  if (!numbers || !numbers.length) return null;
  const low = numbers[0]!;
  const high = numbers[1] ?? low;
  return low <= high ? [low, high] : [high, low];
}

interface ShippingOption {
  cost: number;
  delay: [number, number] | null;
  service: string;
}

/** The cheapest carrier that will actually take the parcel, and what it said. */
export function cheapestOption(payload: unknown): ShippingOption | null {
  const options = (payload as { shippingOptions?: unknown[] } | null)?.shippingOptions;
  if (!Array.isArray(options)) return null;
  let best: ShippingOption | null = null;
  for (const entry of options) {
    const option = entry as { cost?: unknown; shippingService?: { delay?: unknown; name?: unknown } };
    const cost = typeof option.cost === "number" ? option.cost : Number(option.cost);
    if (!Number.isFinite(cost) || cost < 0) continue;
    if (best && cost >= best.cost) continue;
    best = {
      cost,
      delay: parseDelay(option.shippingService?.delay),
      service: typeof option.shippingService?.name === "string" ? option.shippingService.name : "the carrier",
    };
  }
  return best;
}

export interface BigBuyAdapter extends SupplierAdapter {
  /** BigBuy cannot call us, so this is how tracking arrives. */
  tracking(supplierReference: string): Promise<{ ok: true; tracking: BigBuyTracking[] } | { ok: false; reason: string }>;
}

export function bigbuyAdapter(options: BigBuyOptions): BigBuyAdapter {
  const base = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const language = options.language ?? "en";
  const paymentMethod = options.paymentMethod ?? "moneybox";
  const carriers = options.carriers ?? [];

  const call = async (path: string, body?: unknown): Promise<{ ok: boolean; status: number; payload: unknown }> => {
    const response = await doFetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
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

  /** One envelope for check and create: BigBuy reads the same shape twice. */
  const envelope = (input: { orderId: string; lines: { supplierSku: string; quantity: number }[]; address: OrderAddress }) => ({
    order: {
      internalReference: input.orderId,
      language,
      paymentMethod,
      ...(carriers.length ? { carriers: carriers.map((name) => ({ name })) } : {}),
      shippingAddress: {
        firstName: input.address.name.split(" ")[0] ?? input.address.name,
        lastName: input.address.name.split(" ").slice(1).join(" ") || "-",
        country: input.address.country,
        postcode: input.address.postcode,
        town: input.address.town,
        address: [input.address.line1, input.address.line2].filter(Boolean).join(", "),
        phone: input.address.phone ?? "",
        email: input.address.email,
        comment: "",
      },
      products: input.lines.map((line) => ({ reference: line.supplierSku, quantity: line.quantity })),
    },
  });

  /** BigBuy reports refusals inside a 200: `errors[]` with a code and a message. */
  const refusal = (payload: unknown): { reason: string; retryable: boolean } | null => {
    const errors = (payload as { errors?: unknown[] } | null)?.errors;
    if (!Array.isArray(errors) || !errors.length) return null;
    const first = errors[0] as { status?: number; code?: string; message?: string };
    const message = typeof first.message === "string" ? first.message : "the supplier refused it";
    const outOfStock = /no stock/i.test(message) || /ER003/.test(first.code ?? "");
    return {
      reason: outOfStock ? `out of stock (${message.replace(/\s+/g, " ").slice(0, 160)})` : `${first.code ?? "error"}: ${message.slice(0, 160)}`,
      /* Stock is a wall, a 5xx is weather. */
      retryable: !outOfStock && typeof first.status === "number" && first.status >= 500,
    };
  };

  return {
    name: "BigBuy",

    async quote(input) {
      if (!options.toShopCurrency) {
        return {
          ok: false,
          reason:
            "BigBuy quotes shipping in EUR and this shop trades in GBP. Set a conversion rate (toShopCurrency) before promising a delivery price.",
        };
      }
      const result = await call("/rest/shipping/orders.json", {
        order: {
          delivery: { isoCountry: input.address.country, postcode: input.address.postcode },
          products: input.lines.map((line) => ({ reference: line.supplierSku, quantity: line.quantity })),
        },
      });
      if (!result.ok) return { ok: false, reason: `BigBuy answered ${result.status} for a shipping quote.` };
      const best = cheapestOption(result.payload);
      if (!best) return { ok: false, reason: "BigBuy returned no carrier that will take this parcel." };
      return {
        ok: true,
        shippingMinor: options.toShopCurrency(Math.round(best.cost * 100)),
        currency: "GBP",
        etaDays: best.delay,
      };
    },

    async place(input) {
      const body = envelope(input);

      const checked = await call("/rest/order/check/multishipping.json", body);
      if (!checked.ok) {
        return { ok: false, reason: `BigBuy answered ${checked.status} while checking the order.`, retryable: checked.status >= 500 };
      }
      const checkRefusal = refusal(checked.payload);
      if (checkRefusal) return { ok: false, ...checkRefusal };

      const created = await call("/rest/order/create/multishipping.json", body);
      if (!created.ok) {
        /* A 4xx here is the order being refused; a 5xx is BigBuy being unwell and
           the check having been right, so it can be retried. */
        return { ok: false, reason: `BigBuy answered ${created.status} while creating the order.`, retryable: created.status >= 500 };
      }
      const createRefusal = refusal(created.payload);
      if (createRefusal) return { ok: false, ...createRefusal };

      const orders = (created.payload as { orders?: { id?: unknown; warehouse?: unknown }[] } | null)?.orders;
      const ids = Array.isArray(orders) ? orders.map((order) => String(order.id ?? "")).filter(Boolean) : [];
      if (!ids.length) return { ok: false, reason: "BigBuy accepted the request but returned no order id.", retryable: false };
      return {
        ok: true,
        supplierReference: ids[0]!,
        /* A basket split across warehouses arrives as several orders. */
        ...(ids.length > 1 ? { additionalReferences: ids.slice(1) } : {}),
      };
    },

    /** BigBuy has no webhooks: everything arrives by asking. */
    parseCallback() {
      return null;
    },

    async tracking(supplierReference) {
      const result = await call(`/rest/tracking/order/${encodeURIComponent(supplierReference)}.json`);
      if (!result.ok) return { ok: false, reason: `BigBuy answered ${result.status} for tracking.` };
      /* The payload's shape is not documented finely enough to be trusted, so
         anything shaped like a tracking number is collected and the raw body is
         kept for the order history. */
      const found: BigBuyTracking[] = [];
      const walk = (value: unknown, depth = 0) => {
        if (!value || depth > 4) return;
        if (Array.isArray(value)) {
          value.forEach((entry) => walk(entry, depth + 1));
          return;
        }
        if (typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        const number = record.trackingNumber ?? record.tracking_number ?? record.number;
        if (typeof number === "string" && number.trim()) {
          const carrier = record.carrier ?? record.carrierName ?? record.carrier_name;
          found.push({ carrier: typeof carrier === "string" ? carrier : null, number: number.trim(), raw: value });
        }
        Object.values(record).forEach((entry) => walk(entry, depth + 1));
      };
      walk(result.payload);
      return { ok: true, tracking: found };
    },
  };
}

/** Tracking as order events, so a poll can advance the state machine. */
export function trackingEvents(tracking: BigBuyTracking[], at: number): OrderEvent[] {
  return tracking
    .filter((entry) => entry.number)
    .map((entry) => ({
      type: "shipped" as const,
      at,
      carrier: entry.carrier ?? "the carrier",
      trackingNumber: entry.number!,
    }));
}
