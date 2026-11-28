import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eventToChange, parseEvent, verifySignature } from "./stripeWebhook";
import { memoryStore } from "./orderStore";
import { handleStripeWebhook } from "./stripeWebhookHandler";
import { buildOrderFromSession, decodeCart, encodeCart } from "./orderFromSession";
import type { CatalogueEntry } from "./orderFromSession";
import type { SupplierAdapter } from "./orders";

const SECRET = "whsec_test_secret";
const NOW = 1_700_000_000_000;
const timestamp = Math.floor(NOW / 1000);

const catalogue: CatalogueEntry[] = [
  { id: "HG-1001", sku: "HG-SHELF-01", name: "Bamboo folding shelf rack", priceMinor: 4_999 },
  { id: "HG-1004", sku: "HG-TABLE-45", name: "Oak side table", priceMinor: 8_900 },
];

const sign = (body: string, at = timestamp) =>
  `t=${at},v1=${createHmac("sha256", SECRET).update(`${at}.${body}`).digest("hex")}`;

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_test_a1",
  object: "checkout.session",
  payment_status: "paid",
  payment_intent: "pi_test_1",
  amount_total: 4_999 + 395,
  metadata: { cart: "HG-1001x1" },
  customer_details: { email: "buyer@example.com", name: "A Buyer", phone: "+441130000000" },
  collected_information: {
    shipping_details: { name: "A Buyer", address: { line1: "1 Example Street", city: "Leeds", postcode: "LS1 1AA", country: "GB" } },
  },
  ...overrides,
});

const event = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", type, data: { object } });

const post = (payload: unknown, options: { secret?: string; at?: number } = {}) => {
  const body = JSON.stringify(payload);
  return { body, signature: sign(body, options.at ?? timestamp), secret: options.secret ?? SECRET };
};

describe("the signature", () => {
  const payload = '{"id":"evt_1"}';

  it("accepts what Stripe would send", () => {
    expect(verifySignature({ payload, header: sign(payload), secret: SECRET, now: NOW })).toEqual({ ok: true });
  });

  it("rejects a body that changed by one character", () => {
    const check = verifySignature({ payload: `${payload} `, header: sign(payload), secret: SECRET, now: NOW });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toMatch(/does not match/);
  });

  it("rejects a signature made with the wrong secret", () => {
    const forged = createHmac("sha256", "whsec_someone_else").update(`${timestamp}.${payload}`).digest("hex");
    const check = verifySignature({ payload, header: `t=${timestamp},v1=${forged}`, secret: SECRET, now: NOW });
    expect(check.ok).toBe(false);
  });

  it("rejects a captured request replayed an hour later", () => {
    const check = verifySignature({ payload, header: sign(payload), secret: SECRET, now: NOW + 3_600_000 });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toMatch(/older than/);
  });

  it("accepts any of several v1 entries, as it does during a rotation", () => {
    const header = `t=${timestamp},v1=${"0".repeat(64)},v1=${createHmac("sha256", SECRET).update(`${timestamp}.${payload}`).digest("hex")}`;
    expect(verifySignature({ payload, header, secret: SECRET, now: NOW })).toEqual({ ok: true });
  });

  it("refuses a header it cannot read rather than guessing", () => {
    expect(verifySignature({ payload, header: undefined, secret: SECRET, now: NOW }).ok).toBe(false);
    expect(verifySignature({ payload, header: "nonsense", secret: SECRET, now: NOW }).ok).toBe(false);
  });
});

describe("reading the event", () => {
  it("finds the three things the shop cares about", () => {
    expect(eventToChange(event("checkout.session.completed", session()) as never)?.kind).toBe("paid");
    expect(eventToChange(event("checkout.session.expired", { id: "cs_test_a1" }) as never)?.kind).toBe("expired");
    const refund = eventToChange(event("charge.refunded", { payment_intent: "pi_test_1", amount_refunded: 5_394 }) as never);
    expect(refund).toMatchObject({ kind: "refunded", amountMinor: 5_394 });
  });

  it("does not call an unpaid session paid", () => {
    const unpaid = session({ payment_status: "unpaid" });
    expect(eventToChange(event("checkout.session.completed", unpaid) as never)).toBeNull();
  });

  it("ignores everything else", () => {
    expect(eventToChange(event("customer.created", { id: "cus_1" }) as never)).toBeNull();
  });

  it("refuses a body that is not an event", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent('{"id":"evt_1"}')).toBeNull();
  });
});

describe("the basket Stripe carries", () => {
  it("round-trips ids and quantities", () => {
    const cart = [{ id: "HG-1001", qty: 2 }, { id: "HG-1004", qty: 1 }];
    expect(decodeCart(encodeCart(cart))).toEqual(cart);
  });

  it("refuses anything it cannot read, rather than guessing", () => {
    expect(decodeCart("HG-1001")).toBeNull();
    expect(decodeCart("HG-1001x0")).toBeNull();
    expect(decodeCart("")).toBeNull();
    expect(decodeCart(undefined)).toBeNull();
  });
});

describe("building an order from the session", () => {
  it("re-prices from the catalogue and works out the carriage", () => {
    const built = buildOrderFromSession({ session: session(), catalogue, supplier: "BigBuy", at: NOW });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.order.id).toBe("ord_cs_test_a1");
    expect(built.order.lines[0]).toMatchObject({ id: "HG-1001", supplierSku: "HG-SHELF-01", quantity: 1, unitMinor: 4_999 });
    expect(built.order.shippingMinor).toBe(395);
    expect(built.order.address).toMatchObject({ postcode: "LS1 1AA", email: "buyer@example.com" });
  });

  it("uses the supplier's own reference when the imported file knows it", () => {
    const built = buildOrderFromSession({
      session: session(),
      catalogue,
      supplier: "BigBuy",
      at: NOW,
      supplierSkuFor: (product) => ({ "HG-1001": "V0100100" })[product.id],
    });
    if (!built.ok) throw new Error("expected an order");
    expect(built.order.lines[0]!.supplierSku).toBe("V0100100");
  });

  it("refuses when the money does not match the basket", () => {
    const built = buildOrderFromSession({ session: session({ amount_total: 100 }), catalogue, supplier: "BigBuy", at: NOW });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems[0]).toMatch(/cannot be right/);
  });

  it("refuses when there is no address to send a parcel to", () => {
    const built = buildOrderFromSession({ session: session({ collected_information: {}, customer_details: { email: "a@b.c" } }), catalogue, supplier: "BigBuy", at: NOW });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems[0]).toMatch(/delivery address/);
  });
});

describe("the webhook, end to end", () => {
  const base = {
    method: "POST",
    env: { STRIPE_WEBHOOK_SECRET: SECRET, SUPPLIER_NAME: "BigBuy" },
    catalogue,
    now: NOW,
  };

  const headers = (signature: string) => ({ "stripe-signature": signature });

  it("records a paid order once, and says so twice without writing it twice", async () => {
    const store = memoryStore();
    const payload = post(event("checkout.session.completed", session()));

    const first = await handleStripeWebhook({ ...base, store, headers: headers(payload.signature), body: payload.body });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, status: "paid", next: "submit" });
    expect(store.all()).toHaveLength(1);

    const again = await handleStripeWebhook({ ...base, store, headers: headers(payload.signature), body: payload.body });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ duplicate: true, orderId: "ord_cs_test_a1" });
    expect(store.all()).toHaveLength(1);
  });

  it("hands it to the supplier and records what they said", async () => {
    const store = memoryStore();
    const placed: string[] = [];
    const adapter: SupplierAdapter = {
      name: "BigBuy",
      async quote() {
        return { ok: true, shippingMinor: 495, currency: "GBP", etaDays: [2, 3] };
      },
      async place(input) {
        placed.push(input.orderId);
        return { ok: true, supplierReference: "15012345", additionalReferences: ["15012346"] };
      },
      parseCallback() {
        return null;
      },
    };

    const payload = post(event("checkout.session.completed", session()));
    const result = await handleStripeWebhook({ ...base, store, adapterFor: () => adapter, headers: headers(payload.signature), body: payload.body });

    expect(result.body).toMatchObject({ status: "submitted", next: "wait" });
    expect(placed).toEqual(["ord_cs_test_a1"]);
    expect(store.all()[0]!.supplier.reference).toBe("15012345,15012346");
    expect(store.all()[0]!.history.map((entry) => entry.status)).toEqual(["pending", "paid", "submitted"]);
  });

  it("turns a refusal into a cancellation that owes a refund", async () => {
    const store = memoryStore();
    const adapter: SupplierAdapter = {
      name: "BigBuy",
      async quote() {
        return { ok: false, reason: "no" };
      },
      async place() {
        return { ok: false, reason: "out of stock (ER003)", retryable: false };
      },
      parseCallback() {
        return null;
      },
    };

    const payload = post(event("checkout.session.completed", session()));
    await handleStripeWebhook({ ...base, store, adapterFor: () => adapter, headers: headers(payload.signature), body: payload.body });

    const saved = store.all()[0]!;
    expect(saved.status).toBe("cancelled");
    expect(saved.refundedMinor).toBe(0);
    expect(saved.history.at(-1)?.note).toMatch(/refund is owed/);
  });

  it("records nothing when the body does not match the signature", async () => {
    const store = memoryStore();
    const payload = post(event("checkout.session.completed", session()));
    const tampered = await handleStripeWebhook({ ...base, store, headers: headers(payload.signature), body: payload.body.replace('"paid"', '"unpaid"') });
    expect(tampered.status).toBe(400);
    expect(store.all()).toHaveLength(0);
  });

  it("refuses to work without a secret or a store, rather than losing the order", async () => {
    const payload = post(event("checkout.session.completed", session()));

    const noSecret = await handleStripeWebhook({
      ...base,
      env: {},
      store: memoryStore(),
      headers: headers(payload.signature),
      body: payload.body,
    });
    expect(noSecret.status).toBe(503);
    expect(noSecret.body.error).toMatch(/STRIPE_WEBHOOK_SECRET/);

    const noStore = await handleStripeWebhook({ ...base, store: null, headers: headers(payload.signature), body: payload.body });
    expect(noStore.status).toBe(503);
    expect(noStore.body.error).toMatch(/No order store/);
  });

  it("says so, loudly, when the money is real and the order is not", async () => {
    const store = memoryStore();
    const payload = post(event("checkout.session.completed", session({ metadata: {} })));
    const result = await handleStripeWebhook({ ...base, store, headers: headers(payload.signature), body: payload.body });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ recorded: false, alert: true });
    expect(store.all()).toHaveLength(0);
  });

  it("records a refund once, and only the new part of it", async () => {
    const store = memoryStore();
    const paid = post(event("checkout.session.completed", session()));
    await handleStripeWebhook({ ...base, store, headers: headers(paid.signature), body: paid.body });

    const partial = post(event("charge.refunded", { payment_intent: "pi_test_1", amount_refunded: 1_000 }));
    const first = await handleStripeWebhook({ ...base, store, headers: headers(partial.signature), body: partial.body });
    expect(first.body).toMatchObject({ refundedMinor: 1_000, status: "paid" });

    const same = await handleStripeWebhook({ ...base, store, headers: headers(partial.signature), body: partial.body });
    expect(same.body).toMatchObject({ ignored: true });

    const rest = post(event("charge.refunded", { payment_intent: "pi_test_1", amount_refunded: 5_394 }));
    const second = await handleStripeWebhook({ ...base, store, headers: headers(rest.signature), body: rest.body });
    expect(second.body).toMatchObject({ status: "refunded", refundedMinor: 5_394 });
  });

  it("ignores an expired session that never became an order", async () => {
    const store = memoryStore();
    const payload = post(event("checkout.session.expired", { id: "cs_test_never" }));
    const result = await handleStripeWebhook({ ...base, store, headers: headers(payload.signature), body: payload.body });
    expect(result.body).toMatchObject({ ignored: true, reason: "nothing was ordered" });
  });

  it("answers 405 to anything that is not a POST", async () => {
    const result = await handleStripeWebhook({ ...base, method: "GET", store: memoryStore(), headers: {}, body: "" });
    expect(result.status).toBe(405);
  });
});
