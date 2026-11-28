import { describe, expect, it } from "vitest";
import {
  applyEvent,
  newOrder,
  nextStep,
  orderTotalMinor,
  type Order,
  type OrderAddress,
  type OrderEvent,
} from "./orders";

const address: OrderAddress = {
  name: "A Customer",
  line1: "1 Example Street",
  town: "Leeds",
  postcode: "LS1 1AA",
  country: "GB",
  email: "customer@example.com",
};

const build = (): Order =>
  newOrder({
    id: "ord_1",
    at: 1_000,
    lines: [
      { id: "hearth-grain-basket", supplierSku: "AOS-4471", title: "Hearth Grain Basket", quantity: 1, unitMinor: 4_166 },
      { id: "kindling-holder", supplierSku: "AOS-4472", title: "Kindling Holder", quantity: 2, unitMinor: 1_500 },
    ],
    shippingMinor: 495,
    address,
    supplier: "Aosom",
  });

const paid = (at = 2_000, session = "cs_test_1"): OrderEvent => ({ type: "paid", at, stripeSessionId: session });
const submitted = (at = 3_000, reference = "SUP-77"): OrderEvent => ({ type: "submitted", at, supplierReference: reference });

/** Apply a run of events, insisting each one is accepted. */
const play = (events: OrderEvent[]): Order => {
  let order = build();
  for (const event of events) {
    const result = applyEvent(order, event);
    if (!result.ok) throw new Error(`odd: ${event.type} refused — ${result.reason}`);
    order = result.order;
  }
  return order;
};

describe("the order total", () => {
  it("is the goods plus the carriage the customer paid", () => {
    // 4166 + 2 x 1500 + 495
    expect(orderTotalMinor(build())).toBe(7_661);
  });
});

describe("an order is created", () => {
  it("starts pending, owed to nobody, with the supplier named", () => {
    const order = build();
    expect(order.status).toBe("pending");
    expect(order.supplier.reference).toBeNull();
    expect(order.refundedMinor).toBe(0);
    expect(order.history).toHaveLength(1);
  });

  it("refuses to exist without a supplier reference on every line", () => {
    expect(() =>
      newOrder({
        id: "ord_bad",
        at: 1,
        lines: [{ id: "x", supplierSku: "", title: "x", quantity: 1, unitMinor: 100 }],
        shippingMinor: 0,
        address,
        supplier: "Aosom",
      }),
    ).toThrow(/supplier reference/);
  });
});

describe("paying", () => {
  it("moves a pending order to paid, and owes a submission", () => {
    const order = play([paid()]);
    expect(order.status).toBe("paid");
    expect(order.stripeSessionId).toBe("cs_test_1");
    expect(nextStep(order)).toBe("submit");
  });

  it("ignores the same payment arriving again, so Stripe can stop retrying", () => {
    const once = play([paid()]);
    const twice = applyEvent(once, paid(9_000));
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.changed).toBe(false);
    expect(twice.order.status).toBe("paid");
    expect(twice.order.history).toHaveLength(once.history.length);
    expect(nextStep(twice.order)).toBe("submit");
  });

  it("refuses a second, different payment for an order that is already paid", () => {
    const once = play([paid()]);
    const other = applyEvent(once, paid(9_000, "cs_test_other"));
    expect(other.ok).toBe(false);
    if (other.ok) return;
    expect(other.reason).toMatch(/cannot be paid again/);
  });

  it("refuses to pay for an order the supplier has already shipped", () => {
    const shipped = play([paid(), submitted(), { type: "accepted", at: 3_500 }, { type: "shipped", at: 4_000, carrier: "DX", trackingNumber: "DX123" }]);
    const result = applyEvent(shipped, paid(5_000, "cs_late"));
    expect(result.ok).toBe(false);
  });
});

describe("handing it to the supplier", () => {
  it("records their reference once, and does not ask twice", () => {
    const sent = play([paid(), submitted()]);
    expect(sent.status).toBe("submitted");
    expect(sent.supplier.reference).toBe("SUP-77");

    const again = applyEvent(sent, submitted(9_000));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.changed).toBe(false);
  });

  it("refuses to submit an order nobody has paid for", () => {
    const result = applyEvent(build(), submitted());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Only a paid order/);
  });

  it("refuses a different reference for an order already submitted", () => {
    const sent = play([paid(), submitted()]);
    const conflict = applyEvent(sent, submitted(9_000, "SUP-99"));
    expect(conflict.ok).toBe(false);
  });

  it("waits once it is away, and nothing more is owed", () => {
    expect(nextStep(play([paid(), submitted()]))).toBe("wait");
    expect(nextStep(play([paid(), submitted(), { type: "shipped", at: 4_000, carrier: "DX", trackingNumber: "DX1" }]))).toBe("wait");
  });
});

describe("shipping and delivery", () => {
  it("keeps the tracking the customer will be sent", () => {
    const order = play([
      paid(),
      submitted(),
      { type: "shipped", at: 4_000, carrier: "Royal Mail", trackingNumber: "RM42", trackingUrl: "https://track.example/RM42" },
    ]);
    expect(order.status).toBe("shipped");
    expect(order.tracking).toEqual({ carrier: "Royal Mail", number: "RM42", url: "https://track.example/RM42" });
    expect(order.history.at(-1)?.note).toContain("Royal Mail, RM42");
  });

  it("cannot ship before the supplier has it", () => {
    const result = applyEvent(play([paid()]), { type: "shipped", at: 4_000, carrier: "DX", trackingNumber: "DX1" });
    expect(result.ok).toBe(false);
  });

  it("cannot arrive before it has shipped", () => {
    const result = applyEvent(play([paid(), submitted()]), { type: "delivered", at: 5_000 });
    expect(result.ok).toBe(false);
  });
});

describe("when it goes wrong after the customer has paid", () => {
  it("turns a refusal into a cancellation that owes a refund", () => {
    const order = play([paid(), { type: "refused", at: 3_000, reason: "out of stock", retryable: false }]);
    expect(order.status).toBe("cancelled");
    expect(nextStep(order)).toBe("refund");
    expect(order.history.at(-1)?.note).toMatch(/refund is owed/);
  });

  it("cancels from paid, and stops owing a submission", () => {
    const order = play([paid(), { type: "cancelled", at: 3_000, reason: "customer changed their mind" }]);
    expect(nextStep(order)).toBe("refund");
  });

  it("refuses a cancellation after dispatch — that is a return", () => {
    const shipped = play([paid(), submitted(), { type: "shipped", at: 4_000, carrier: "DX", trackingNumber: "DX1" }]);
    const result = applyEvent(shipped, { type: "cancelled", at: 5_000, reason: "too late" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/return, not a cancellation/);
  });
});

describe("refunds", () => {
  it("gives the money back and lands on refunded at the full amount", () => {
    const order = play([paid(), { type: "refunded", at: 3_000, amountMinor: 7_661, reason: "out of stock" }]);
    expect(order.status).toBe("refunded");
    expect(order.refundedMinor).toBe(7_661);
    expect(nextStep(order)).toBe("none");
  });

  it("keeps a partial refund open and does not call it a refund", () => {
    const order = play([paid(), { type: "refunded", at: 3_000, amountMinor: 1_500, reason: "one item missing" }]);
    expect(order.status).toBe("paid");
    expect(order.refundedMinor).toBe(1_500);
  });

  it("will not give back more than was taken", () => {
    const result = applyEvent(play([paid()]), { type: "refunded", at: 3_000, amountMinor: 99_999, reason: "mistake" });
    expect(result.ok).toBe(false);
  });

  it("will not refund the same money twice", () => {
    const refunded = play([paid(), { type: "refunded", at: 3_000, amountMinor: 4_000, reason: "part" }]);
    const again = applyEvent(refunded, { type: "refunded", at: 3_100, amountMinor: 4_000, reason: "part" });
    expect(again.ok).toBe(false);
  });

  it("treats a refund as final: a late dispatch is history, not a parcel", () => {
    const refunded = play([paid(), { type: "refunded", at: 3_000, amountMinor: 7_661, reason: "out of stock" }]);
    const late = applyEvent(refunded, { type: "shipped", at: 9_000, carrier: "DX", trackingNumber: "DX9" });
    expect(late.ok).toBe(true);
    if (!late.ok) return;
    expect(late.changed).toBe(false);
    expect(late.order.status).toBe("refunded");
    expect(late.order.tracking).toBeNull();
    expect(late.order.history.at(-1)?.note).toBe("ignored after refund: shipped");
  });
});
