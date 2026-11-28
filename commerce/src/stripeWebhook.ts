/**
 * Stripe says a thing happened. This decides whether it matters.
 *
 * Two jobs, both small:
 *
 * 1. **Prove the request came from Stripe.** Anyone can POST to a public URL, so
 *    the signature is checked before the body is even parsed. Constant-time
 *    comparison, and a timestamp within a few minutes so a captured request
 *    cannot be replayed next week.
 * 2. **Translate.** Stripe has dozens of event types; the shop cares about
 *    three: paid, expired, refunded. Everything else is acknowledged and
 *    ignored, because an unhandled type is not an error — it is a type we do
 *    not subscribe to.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order, OrderEvent } from "./orders.js";

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/**
 * `Stripe-Signature: t=1699999999,v1=hex[,v1=hex]`
 *
 * The signed payload is `${t}.${body}`, HMAC-SHA256 with the endpoint secret.
 * Several `v1` entries appear while a secret is being rotated, so any of them
 * matching is a pass.
 */
export function verifySignature(input: {
  payload: string;
  header: string | string[] | undefined;
  secret: string;
  now: number;
  toleranceSeconds?: number;
}): SignatureCheck {
  const header = Array.isArray(input.header) ? input.header[0] : input.header;
  if (!header) return { ok: false, reason: "no Stripe-Signature header" };
  if (!input.secret) return { ok: false, reason: "no endpoint secret configured" };

  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const offered = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp)) return { ok: false, reason: "no usable timestamp in the signature" };
  if (!offered.length) return { ok: false, reason: "no v1 signature in the header" };

  const tolerance = (input.toleranceSeconds ?? 300) * 1000;
  const age = input.now - Number(timestamp) * 1000;
  /* Allow a little future skew: a clock a few seconds fast is not an attack. */
  if (age > tolerance) return { ok: false, reason: "the signature is older than the tolerance" };
  if (age < -tolerance) return { ok: false, reason: "the signature is dated in the future" };

  const expected = createHmac("sha256", input.secret).update(`${timestamp}.${input.payload}`).digest();
  for (const signature of offered) {
    let given: Buffer;
    try {
      given = Buffer.from(signature, "hex");
    } catch {
      continue;
    }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "the signature does not match the body" };
}

/** The event, or null when the body is not one. */
export function parseEvent(payload: string): StripeEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const event = parsed as Partial<StripeEvent> | null;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") return null;
  if (!event.data || typeof event.data.object !== "object" || event.data.object === null) return null;
  return event as StripeEvent;
}

export type Change =
  /** Money arrived. The order may not exist yet — this is what creates it. */
  | { kind: "paid"; session: Record<string, unknown> }
  /** The shopper walked away. Nothing was charged. */
  | { kind: "expired"; sessionId: string }
  /** Money went back. `amountMinor` is the whole refunded total, not the delta. */
  | { kind: "refunded"; paymentIntentId: string; amountMinor: number };

/**
 * `existing` is needed for refunds because Stripe reports the *cumulative*
 * refunded amount; the difference from what the order has already given back is
 * the event this shop can act on. Reading it as a delta would refund a partial
 * refund again on every retry.
 */
export function eventToChange(event: StripeEvent, existing?: Order | null): Change | null {
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    /* Bank debits complete later. A session that is complete but unpaid is not
       a paid order, and telling the customer it is would be a lie. */
    const paymentStatus = object.payment_status;
    if (typeof paymentStatus === "string" && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") return null;
    return { kind: "paid", session: object };
  }

  if (event.type === "checkout.session.expired") {
    const id = object.id;
    return typeof id === "string" ? { kind: "expired", sessionId: id } : null;
  }

  if (event.type === "charge.refunded" || event.type === "refund.created") {
    const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : "";
    const refundedTotal = typeof object.amount_refunded === "number" ? object.amount_refunded : typeof object.amount === "number" ? object.amount : 0;
    if (!paymentIntentId || refundedTotal <= 0) return null;
    if (existing && refundedTotal <= existing.refundedMinor) return null; /* already recorded */
    return { kind: "refunded", paymentIntentId, amountMinor: refundedTotal };
  }

  return null;
}

/** The change as an order event, given the order it lands on. */
export function changeToEvent(change: Change, order: Order | null, at: number): OrderEvent | null {
  if (change.kind === "paid") {
    return {
      type: "paid",
      at,
      stripeSessionId: String(change.session.id ?? ""),
      ...(typeof change.session.payment_intent === "string" ? { paymentIntentId: change.session.payment_intent } : {}),
    };
  }
  if (change.kind === "refunded") {
    /* A refund we cannot attribute to an order is not one we can record. */
    if (!order) return null;
    const delta = change.amountMinor - order.refundedMinor;
    if (delta <= 0) return null;
    return { type: "refunded", at, amountMinor: delta, reason: "refunded in Stripe" };
  }
  return { type: "cancelled", at, reason: "the shopper did not finish paying" };
}
