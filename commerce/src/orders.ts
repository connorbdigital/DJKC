/**
 * The order, and the supplier it is handed to.
 *
 * A shop that only takes money is a donations page. Between "Stripe says paid"
 * and "a parcel arrives" there are four things that have to be true, and this
 * file is the first two:
 *
 *  1. **An order exists**, with lines, money, address and a status that only moves
 *     forward through states it is allowed to move through.
 *  2. **Every move is idempotent.** Stripe retries a webhook for days; a supplier
 *     is not a place to discover that we placed the same order twice.
 *  3. A **supplier adapter** turns an order into an order on their side, and their
 *     callback turns back into an event here (`SupplierAdapter` below).
 *  4. Everything that can go wrong after the customer has paid — out of stock,
 *     partial dispatch, a refused order — has a named state, so nothing is left
 *     "somewhere" and the refund is a step rather than a decision.
 *
 * Pure functions, so the rules can be tested without Stripe, without a supplier,
 * and without a database.
 */

export type OrderStatus =
  /** Money not yet confirmed. The only state a browser can create. */
  | "pending"
  /** Stripe says paid. Nothing has been asked of the supplier yet. */
  | "paid"
  /** Sent to the supplier. Not yet acknowledged. */
  | "submitted"
  /** The supplier has accepted it and will ship. */
  | "accepted"
  /** Out of the supplier's hands, with tracking. */
  | "shipped"
  /** Delivered, per the carrier. */
  | "delivered"
  /** Paid, then killed — out of stock, refused, or cancelled by the customer. */
  | "cancelled"
  /** Money given back, in full or in part. Terminal for that money. */
  | "refunded";

export interface OrderLine {
  /** Our id, the one the basket and the Stripe session used. */
  id: string;
  /** The supplier's own reference. Without this nothing can be ordered. */
  supplierSku: string;
  title: string;
  quantity: number;
  /** Unit price in minor units, VAT included, as charged. */
  unitMinor: number;
}

export interface OrderAddress {
  name: string;
  line1: string;
  line2?: string;
  town: string;
  postcode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  email: string;
  phone?: string;
}

export interface OrderEventBase {
  /** When the event happened, ms. Used for ordering and for the history. */
  at: number;
}

export type OrderEvent =
  | (OrderEventBase & { type: "paid"; stripeSessionId: string; paymentIntentId?: string })
  | (OrderEventBase & { type: "submitted"; supplierReference: string })
  | (OrderEventBase & { type: "accepted"; supplierReference?: string })
  | (OrderEventBase & { type: "shipped"; carrier: string; trackingNumber: string; trackingUrl?: string })
  | (OrderEventBase & { type: "delivered" })
  | (OrderEventBase & { type: "cancelled"; reason: string })
  | (OrderEventBase & { type: "refunded"; amountMinor: number; reason: string })
  | (OrderEventBase & { type: "refused"; reason: string; retryable: boolean });

export interface OrderHistory {
  at: number;
  status: OrderStatus;
  note: string;
}

export interface Order {
  id: string;
  /** Set on the first `paid` event and never changed: it is how a retry is recognised. */
  stripeSessionId: string | null;
  paymentIntentId: string | null;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  lines: OrderLine[];
  /** What the customer paid for carriage, minor units. */
  shippingMinor: number;
  address: OrderAddress | null;
  supplier: {
    name: string;
    /** The supplier's own id for this order, once they have one. */
    reference: string | null;
  };
  tracking: { carrier: string; number: string; url?: string } | null;
  /** Money already returned, so a partial refund cannot become a full one by accident. */
  refundedMinor: number;
  history: OrderHistory[];
}

const sum = (lines: OrderLine[]): number => lines.reduce((total, line) => total + line.unitMinor * line.quantity, 0);

/** Goods plus carriage, VAT included, which is what the customer was charged. */
export function orderTotalMinor(order: Order): number {
  return sum(order.lines) + order.shippingMinor;
}

export type ApplyResult =
  | { ok: true; order: Order; changed: boolean }
  | { ok: false; reason: string };

/**
 * The state machine.
 *
 * Two rules earn their keep here:
 *
 *  - **A `paid` event for a session we have already paid is not an error.** Stripe
 *    retries, and the second delivery of the same fact must not create a second
 *    order or a second supplier submission. It returns the order unchanged, so the
 *    caller can answer 200 and stop the retries.
 *  - **A refund is a status, not a note.** Once `refunded`, nothing else moves; a
 *    late `shipped` callback for a refunded order is recorded in the history and
 *    ignored, rather than telling the customer their money came back and is also
 *    on its way.
 */
export function applyEvent(order: Order, event: OrderEvent): ApplyResult {
  const move = (status: OrderStatus, note: string): ApplyResult => ({
    ok: true,
    changed: true,
    order: {
      ...order,
      status,
      updatedAt: event.at,
      history: [...order.history, { at: event.at, status, note }],
    },
  });

  const refuse = (reason: string): ApplyResult => ({ ok: false, reason });

  if (order.status === "refunded") {
    /* Terminal for money. Everything after it is history, not state. */
    return { ok: true, changed: false, order: { ...order, history: [...order.history, { at: event.at, status: order.status, note: `ignored after refund: ${event.type}` }] } };
  }

  switch (event.type) {
    case "paid": {
      if (order.status !== "pending") {
        /* The same payer, told twice. Anything else is money we cannot explain. */
        if (order.stripeSessionId === event.stripeSessionId) return { ok: true, changed: false, order };
        return refuse(`An order that is already ${order.status} cannot be paid again by a different session.`);
      }
      return {
        ok: true,
        changed: true,
        order: {
          ...order,
          status: "paid",
          stripeSessionId: event.stripeSessionId,
          paymentIntentId: event.paymentIntentId ?? null,
          updatedAt: event.at,
          history: [...order.history, { at: event.at, status: "paid", note: "Stripe confirmed the payment" }],
        },
      };
    }

    case "submitted": {
      if (order.status === "submitted" || order.status === "accepted" || order.status === "shipped") {
        /* A retried submission with the same reference is the supplier agreeing twice. */
        if (order.supplier.reference === event.supplierReference) return { ok: true, changed: false, order };
        return refuse(`Already submitted as ${order.supplier.reference ?? "an unknown reference"}.`);
      }
      if (order.status !== "paid") return refuse(`Only a paid order can be submitted; this one is ${order.status}.`);
      return {
        ok: true,
        changed: true,
        order: {
          ...order,
          status: "submitted",
          supplier: { ...order.supplier, reference: event.supplierReference },
          updatedAt: event.at,
          history: [...order.history, { at: event.at, status: "submitted", note: `Sent to ${order.supplier.name} as ${event.supplierReference}` }],
        },
      };
    }

    case "accepted": {
      if (order.status !== "submitted") return refuse(`Only a submitted order can be accepted; this one is ${order.status}.`);
      return move("accepted", `${order.supplier.name} accepted the order`);
    }

    case "shipped": {
      if (order.status !== "submitted" && order.status !== "accepted") {
        return refuse(`Nothing can ship from ${order.status}.`);
      }
      const shipped: ApplyResult = move("shipped", `Dispatched with ${event.carrier}, ${event.trackingNumber}`);
      if (!shipped.ok) return shipped;
      return {
        ok: true,
        changed: true,
        order: { ...shipped.order, tracking: { carrier: event.carrier, number: event.trackingNumber, ...(event.trackingUrl ? { url: event.trackingUrl } : {}) } },
      };
    }

    case "delivered": {
      if (order.status !== "shipped") return refuse(`Only a shipped order can be delivered; this one is ${order.status}.`);
      return move("delivered", "The carrier says it arrived");
    }

    case "cancelled": {
      if (order.status === "shipped" || order.status === "delivered") {
        return refuse("Shipped goods are a return, not a cancellation.");
      }
      return move("cancelled", `Cancelled: ${event.reason}. ${event.type === "cancelled" ? "A refund is owed." : ""}`.trim());
    }

    case "refused": {
      /* The supplier said no: out of stock, an address they cannot reach, a
         product pulled. It is a cancellation the customer did not ask for, and it
         must be refunded whether or not the supplier is reachable again. */
      if (order.status !== "paid" && order.status !== "submitted") {
        return refuse(`A refusal cannot arrive while the order is ${order.status}.`);
      }
      return move("cancelled", `${order.supplier.name} refused the order: ${event.reason}. A refund is owed.${event.retryable ? " The submission may be retried by hand." : ""}`);
    }

    case "refunded": {
      const total = orderTotalMinor(order);
      const already = order.refundedMinor;
      if (event.amountMinor <= 0) return refuse("A refund of nothing is not a refund.");
      if (already + event.amountMinor > total) {
        return refuse(`That refund would give back ${already + event.amountMinor} of ${total}.`);
      }
      const refunded = already + event.amountMinor;
      const status: OrderStatus = refunded >= total ? "refunded" : order.status;
      return {
        ok: true,
        changed: true,
        order: {
          ...order,
          status,
          refundedMinor: refunded,
          updatedAt: event.at,
          history: [
            ...order.history,
            { at: event.at, status, note: `Refunded ${event.amountMinor} of ${total}: ${event.reason}` },
          ],
        },
      };
    }
  }
}

/**
 * What has to happen next, in the order it has to happen.
 *
 * The shop asks this after every event instead of keeping a to-do list in its head:
 * `paid` owes a submission, a cancellation owes a refund, and a submitted order owes
 * nothing but patience.
 */
export function nextStep(order: Order): "submit" | "refund" | "wait" | "none" {
  if (order.status === "paid") return "submit";
  if (order.status === "cancelled" && order.refundedMinor < orderTotalMinor(order)) return "refund";
  if (order.status === "submitted" || order.status === "accepted" || order.status === "shipped") return "wait";
  return "none";
}

/** An order as the shop can build it, before any money exists. */
export function newOrder(input: {
  id: string;
  at: number;
  lines: OrderLine[];
  shippingMinor: number;
  address: OrderAddress;
  supplier: string;
}): Order {
  if (!input.lines.length) throw new Error("An order with no lines is not an order.");
  if (input.lines.some((line) => line.quantity < 1 || !line.supplierSku)) {
    throw new Error("Every line needs a supplier reference and at least one unit.");
  }
  return {
    id: input.id,
    stripeSessionId: null,
    paymentIntentId: null,
    status: "pending",
    createdAt: input.at,
    updatedAt: input.at,
    lines: input.lines,
    shippingMinor: input.shippingMinor,
    address: input.address,
    supplier: { name: input.supplier, reference: null },
    tracking: null,
    refundedMinor: 0,
    history: [{ at: input.at, status: "pending", note: "Created from the basket" }],
  };
}

/**
 * The four calls a supplier has to answer, and nothing more.
 *
 * Written as an interface so the first supplier is a file rather than a rewrite:
 * Prodigi and BigBuy both fit this shape, and so does a spreadsheet and a person
 * with a login — which is what most UK wholesalers actually are.
 */
export interface SupplierAdapter {
  readonly name: string;
  /** Price and check before money is taken. Never invents an ETA it does not know. */
  quote(input: {
    lines: { supplierSku: string; quantity: number }[];
    address: Pick<OrderAddress, "postcode" | "country">;
  }): Promise<
    | { ok: true; shippingMinor: number; currency: string; etaDays: [number, number] | null }
    | { ok: false; reason: string }
  >;
  /** Place it. `retryable` decides whether a failure is ours to retry or a wall. */
  place(input: {
    orderId: string;
    lines: { supplierSku: string; quantity: number }[];
    address: OrderAddress;
  }): Promise<
    | {
        ok: true;
        supplierReference: string;
        /** One basket can become several orders: one per warehouse. */
        additionalReferences?: string[];
      }
    | { ok: false; reason: string; retryable: boolean }
  >;
  /** Their callback, in their shape, read into ours. Null when it is not one. */
  parseCallback(payload: unknown): OrderEvent | null;
}
