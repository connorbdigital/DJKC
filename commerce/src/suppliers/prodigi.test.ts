import { describe, expect, it } from "vitest";
import { prodigiAdapter, readStatus, statusToEvent, toMinor } from "./prodigi";
import type { OrderAddress } from "../orders";

const address: OrderAddress = {
  name: "Ada Lovelace",
  line1: "1 Example Street",
  line2: "Flat 2",
  town: "Leeds",
  postcode: "LS1 1AA",
  country: "GB",
  email: "ada@example.com",
  phone: "+441130000000",
};

const lines = [{ supplierSku: "HG-PRINT-01", quantity: 2 }];

const items = {
  "HG-PRINT-01": { sku: "GLOBAL-CAN-16X20", asset: "https://shop.example/art/frame.png" },
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const key = Object.keys(routes).find((path) => href.endsWith(path));
    const route = key ? routes[key]! : { status: 404, body: { outcome: "error" } };
    calls.push({
      url: href,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const quoteBody = { outcome: "Ok", quotes: [{ costs: { shipping: { amount: "4.90", currency: "GBP" } } }] };

describe("Prodigi's numbers", () => {
  it("reads a decimal string as pence, and refuses nonsense", () => {
    expect(toMinor("4.90")).toBe(490);
    expect(toMinor(4.9)).toBe(490);
    expect(toMinor("0.00")).toBe(0);
    expect(toMinor("free")).toBeNull();
    expect(toMinor(-1)).toBeNull();
  });
});

describe("quoting", () => {
  it("prices the basket for the destination, in the shop's own money", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/Quotes": { body: quoteBody } });
    const adapter = prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items });
    const quote = await adapter.quote({ lines, address });

    expect(quote).toMatchObject({ ok: true, shippingMinor: 490, currency: "GBP", etaDays: null });
    expect(calls[0]).toMatchObject({ url: "https://api.prodigi.com/v4.0/Quotes", method: "POST", headers: { "X-API-Key": "k" } });
    expect(calls[0]!.body).toEqual({
      shippingMethod: "Budget",
      destinationCountryCode: "GB",
      items: [{ sku: "GLOBAL-CAN-16X20", copies: "2", assets: [{ printArea: "default", url: "https://shop.example/art/frame.png" }] }],
    });
  });

  it("does not promise a delivery window Prodigi never gave", async () => {
    const { fetchImpl } = fakeFetch({ "/Quotes": { body: quoteBody } });
    const quote = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items }).quote({ lines, address });
    expect(quote.ok && quote.etaDays).toBeNull();
  });

  it("refuses a product nobody has said how to print", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/Quotes": { body: quoteBody } });
    const quote = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items: {} }).quote({ lines, address });
    expect(quote.ok).toBe(false);
    if (quote.ok) return;
    expect(quote.reason).toMatch(/HG-PRINT-01/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a placeholder as artwork, because an SVG cannot be printed", async () => {
    const { fetchImpl } = fakeFetch({ "/Quotes": { body: quoteBody } });
    const svg = { "HG-PRINT-01": { sku: "GLOBAL-CAN-16X20", asset: "https://shop.example/assets/art.svg" } };
    const quote = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items: svg }).quote({ lines, address });
    expect(quote.ok).toBe(false);
    if (quote.ok) return;
    expect(quote.reason).toMatch(/not a print-ready/);
  });

  it("points at the sandbox when it is told to", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/Quotes": { body: quoteBody } });
    await prodigiAdapter({ apiKey: "k", baseUrl: "https://api.sandbox.prodigi.com/v4.0/", fetch: fetchImpl, items }).quote({ lines, address });
    expect(calls[0]!.url).toBe("https://api.sandbox.prodigi.com/v4.0/Quotes");
  });
});

describe("placing an order", () => {
  it("sends the recipient, the items and our order id twice, so a retry cannot print twice", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/Orders": { body: { outcome: "Ok", order: { id: "prodigi-123" } } } });
    const placed = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items, shippingMethod: "Standard" }).place({
      orderId: "ord_cs_1",
      lines,
      address,
    });

    expect(placed).toEqual({ ok: true, supplierReference: "prodigi-123" });
    expect(calls[0]!.body).toEqual({
      merchantReference: "ord_cs_1",
      idempotencyKey: "ord_cs_1",
      shippingMethod: "Standard",
      recipient: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "+441130000000",
        address: { line1: "1 Example Street", line2: "Flat 2", town: "Leeds", postcode: "LS1 1AA", countryCode: "GB" },
      },
      items: [{ sku: "GLOBAL-CAN-16X20", copies: "2", assets: [{ printArea: "default", url: "https://shop.example/art/frame.png" }] }],
      metadata: { orderId: "ord_cs_1" },
    });
  });

  it("treats a 409 as the retry that already succeeded", async () => {
    const { fetchImpl } = fakeFetch({ "/Orders": { status: 409, body: { order: { id: "prodigi-123" } } } });
    const placed = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items }).place({ orderId: "ord_cs_1", lines, address });
    expect(placed).toEqual({ ok: true, supplierReference: "prodigi-123" });
  });

  it("calls a bad order final and a broken Prodigi retryable", async () => {
    const bad = fakeFetch({ "/Orders": { status: 400, body: { outcome: "error" } } });
    const rejected = await prodigiAdapter({ apiKey: "k", fetch: bad.fetchImpl, items }).place({ orderId: "o", lines, address });
    expect(rejected).toMatchObject({ ok: false, retryable: false });

    const down = fakeFetch({ "/Orders": { status: 503, body: {} } });
    const retry = await prodigiAdapter({ apiKey: "k", fetch: down.fetchImpl, items }).place({ orderId: "o", lines, address });
    expect(retry).toMatchObject({ ok: false, retryable: true });
  });

  it("refuses to call it placed without an id", async () => {
    const { fetchImpl } = fakeFetch({ "/Orders": { body: { outcome: "Ok", order: {} } } });
    const placed = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items }).place({ orderId: "o", lines, address });
    expect(placed).toMatchObject({ ok: false, retryable: false });
  });
});

describe("what Prodigi says back", () => {
  const callback = (stage: string, shipments: unknown[] = []) => ({
    specversion: "1.0",
    type: "com.prodigi.order.status.changed",
    data: { order: { id: "prodigi-123", status: { stage }, shipments } },
  });

  it("reads the stage and the shipment from a CloudEvent", () => {
    const payload = callback("Complete", [{ tracking: { number: "TRACK1", url: "https://track/1", carrier: { name: "Royal Mail" } } }]);
    expect(readStatus(payload)).toEqual({
      stage: "Complete",
      shipments: [{ carrier: "Royal Mail", number: "TRACK1", url: "https://track/1" }],
    });
  });

  it("reads the API's own order object too, which has no envelope", () => {
    expect(readStatus({ id: "prodigi-123", status: { stage: "InProgress" } })).toEqual({ stage: "InProgress", shipments: [] });
  });

  it("turns a dispatch into a shipped event, and a cancellation into a refusal", () => {
    const shipped = statusToEvent({ stage: "Complete", shipments: [{ carrier: "Royal Mail", number: "TRACK1" }] }, 1_000);
    expect(shipped).toEqual({ type: "shipped", at: 1_000, carrier: "Royal Mail", trackingNumber: "TRACK1" });

    const cancelled = statusToEvent({ stage: "Cancelled", shipments: [] }, 1_000);
    expect(cancelled).toMatchObject({ type: "refused", retryable: false });
  });

  it("returns null for anything it does not understand, rather than a guess", () => {
    expect(readStatus({ nonsense: true })).toBeNull();
    expect(readStatus(null)).toBeNull();
    expect(prodigiAdapter({ apiKey: "k", fetch: fakeFetch({}).fetchImpl, items }).parseCallback({ nothing: 1 })).toBeNull();
  });

  it("polling finds the tracking a missed callback lost", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/Orders/prodigi-123": {
        body: { id: "prodigi-123", status: { stage: "Complete" }, shipments: [{ tracking: { number: "TRACK9", carrier: { name: "DHL" } } }] },
      },
    });
    const found = await prodigiAdapter({ apiKey: "k", fetch: fetchImpl, items }).tracking("prodigi-123");
    expect(found).toEqual({ ok: true, status: { stage: "Complete", shipments: [{ carrier: "DHL", number: "TRACK9" }] } });
    expect(calls[0]!.url).toBe("https://api.prodigi.com/v4.0/Orders/prodigi-123");
  });
});
