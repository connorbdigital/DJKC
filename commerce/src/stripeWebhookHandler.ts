/**
 * What the shop does when Stripe says money arrived.
 *
 * The order of operations is the design:
 *
 *   verify → understand → record → hand to a supplier → answer
 *
 * Nothing is recorded before the signature is checked, nothing is handed to a
 * supplier before it is recorded, and the answer is 200 only when the work is
 * done or provably redundant. Anything else is a non-2xx, because Stripe treats
 * a 200 as "saved" and stops retrying.
 *
 * Kept out of the function file so it can be tested with a fake store, a fake
 * supplier and a signature computed from a known secret — no keys, no network,
 * no Stripe account.
 */
import { applyEvent, nextStep, type Order, type SupplierAdapter } from "./orders.js";
import { buildOrderFromSession, type CatalogueEntry } from "./orderFromSession.js";
import { orderIdForSession, type OrderStore } from "./orderStore.js";
import { changeToEvent, eventToChange, parseEvent, verifySignature } from "./stripeWebhook.js";

export interface WebhookInput {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  env: Record<string, string | undefined>;
  /** Null when no KV is configured: the handler then refuses rather than loses an order. */
  store: OrderStore | null;
  catalogue: CatalogueEntry[];
  /** Which suppliers can be reached from here. Absent means "record it, fulfil by hand". */
  adapterFor?: (order: Order) => SupplierAdapter | null;
  now?: number;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

const header = (headers: WebhookInput["headers"], name: string) => {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(found) ? found[0] : found;
};

export async function handleStripeWebhook(input: WebhookInput): Promise<WebhookResult> {
  const now = input.now ?? Date.now();

  if (input.method !== "POST") return { status: 405, body: { ok: false, error: "Stripe posts here; nothing else does." } };

  const secret = (input.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "STRIPE_WEBHOOK_SECRET is not set, so a signature cannot be checked and nothing can be trusted.",
        fix: "Add the signing secret from the Stripe dashboard webhook endpoint as a sensitive variable on the commerce project.",
      },
    };
  }

  const check = verifySignature({ payload: input.body, header: header(input.headers, "stripe-signature"), secret, now });
  if (!check.ok) return { status: 400, body: { ok: false, error: `Signature rejected: ${check.reason}.` } };

  const event = parseEvent(input.body);
  if (!event) return { status: 400, body: { ok: false, error: "The body is not a Stripe event." } };

  const change = eventToChange(event);
  if (!change) return { status: 200, body: { ok: true, ignored: true, type: event.type } };

  if (!input.store) {
    /* Without somewhere to write, a 200 would tell Stripe the order is safe when
       it is not. Fail loudly; Stripe retries for three days. */
    return {
      status: 503,
      body: {
        ok: false,
        error: "No order store is configured, so a paid order could not be recorded.",
        fix: "Connect a KV/Redis store (KV_REST_API_URL and KV_REST_API_TOKEN) to the commerce project.",
      },
    };
  }

  if (change.kind === "paid") {
    const built = buildOrderFromSession({
      session: change.session,
      catalogue: input.catalogue,
      supplier: (input.env.SUPPLIER_NAME ?? "unassigned").trim() || "unassigned",
      at: now,
    });

    if (!built.ok) {
      /* The money is real and the order is not. This needs a human, and it needs
         to be visible: the body says `alert` so a log-based alarm can find it. */
      return {
        status: 200,
        body: {
          ok: true,
          recorded: false,
          alert: true,
          session: String(change.session.id ?? ""),
          problems: built.problems,
          note: "Paid in Stripe but could not be built into an order. Fulfil by hand and fix the cause.",
        },
      };
    }

    const existing = await input.store.get(built.order.id);
    if (existing) {
      /* Stripe retrying the same fact. Answer 200 so it stops. */
      return { status: 200, body: { ok: true, duplicate: true, orderId: existing.id, status: existing.status } };
    }

    const paid = applyEvent(built.order, {
      type: "paid",
      at: now,
      stripeSessionId: String(change.session.id ?? ""),
      ...(typeof change.session.payment_intent === "string" ? { paymentIntentId: change.session.payment_intent } : {}),
    });
    if (!paid.ok) return { status: 400, body: { ok: false, error: paid.reason } };

    let order = paid.order;
    await input.store.put(order);

    /* Recorded first, so a supplier outage cannot lose the sale. */
    const adapter = input.adapterFor?.(order) ?? null;
    if (adapter && nextStep(order) === "submit") {
      const placed = await adapter.place({
        orderId: order.id,
        lines: order.lines.map((line) => ({ supplierSku: line.supplierSku, quantity: line.quantity })),
        address: order.address!,
      });

      if (placed.ok) {
        const submitted = applyEvent(order, {
          type: "submitted",
          at: now,
          supplierReference: [placed.supplierReference, ...(placed.additionalReferences ?? [])].join(","),
        });
        if (submitted.ok) order = submitted.order;
      } else {
        const refused = applyEvent(order, { type: "refused", at: now, reason: placed.reason, retryable: placed.retryable });
        if (refused.ok) order = refused.order;
      }
      await input.store.put(order);
    }

    return {
      status: 200,
      body: {
        ok: true,
        orderId: order.id,
        status: order.status,
        next: nextStep(order),
        ...(adapter ? {} : { note: "No supplier adapter is configured, so this order is waiting to be placed by hand." }),
      },
    };
  }

  if (change.kind === "expired") {
    const id = orderIdForSession(change.sessionId);
    const existing = await input.store.get(id);
    /* Nothing is written before payment, so an expired session usually has no order. */
    if (!existing) return { status: 200, body: { ok: true, ignored: true, reason: "nothing was ordered" } };
    const cancelled = applyEvent(existing, { type: "cancelled", at: now, reason: "the shopper did not finish paying" });
    if (!cancelled.ok) return { status: 200, body: { ok: true, ignored: true, reason: cancelled.reason } };
    await input.store.put(cancelled.order);
    return { status: 200, body: { ok: true, orderId: id, status: cancelled.order.status } };
  }

  /* Refund: Stripe reports the cumulative amount, the order takes the delta. */
  const existing = await input.store.findByPaymentIntent(change.paymentIntentId);
  if (!existing) {
    return { status: 200, body: { ok: true, unmatched: true, note: "No order for that payment intent." } };
  }
  const refundEvent = changeToEvent(change, existing, now);
  if (!refundEvent) return { status: 200, body: { ok: true, ignored: true, reason: "already recorded" } };

  const refunded = applyEvent(existing, refundEvent);
  if (!refunded.ok) return { status: 200, body: { ok: true, ignored: true, reason: refunded.reason } };
  await input.store.put(refunded.order);
  return { status: 200, body: { ok: true, orderId: refunded.order.id, status: refunded.order.status, refundedMinor: refunded.order.refundedMinor } };
}
