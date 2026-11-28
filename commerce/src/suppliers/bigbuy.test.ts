import { describe, expect, it } from "vitest";
import { bigbuyAdapter, cheapestOption, parseDelay, trackingEvents } from "./bigbuy";
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

const lines = [{ supplierSku: "V0100100", quantity: 2 }];

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fake network that records what was asked and answers in BigBuy's shapes. */
function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const key = Object.keys(routes).find((path) => href.endsWith(path));
    const route = key ? routes[key]! : { status: 404, body: { errors: [{ status: 404, message: "not found" }] } };
    calls.push({
      url: href,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const shippingPayload = {
  shippingOptions: [
    { shippingService: { id: "62", name: "SEUR", delay: "4-5 days" }, cost: 9.68 },
    { shippingService: { id: "180", name: "GLS", delay: "4-6 days" }, cost: 7.2 },
    { shippingService: { id: "90", name: "DHL", delay: "2-3 days" }, cost: 12.4 },
  ],
};

describe("reading BigBuy's own shapes", () => {
  it("parses a delivery window, and refuses to invent one", () => {
    expect(parseDelay("4-6 days")).toEqual([4, 6]);
    expect(parseDelay("48h")).toEqual([48, 48]);
    expect(parseDelay(undefined)).toBeNull();
    expect(parseDelay("soon")).toBeNull();
  });

  it("picks the cheapest carrier that will take the parcel", () => {
    expect(cheapestOption(shippingPayload)).toMatchObject({ cost: 7.2, service: "GLS", delay: [4, 6] });
    expect(cheapestOption({ shippingOptions: [] })).toBeNull();
    expect(cheapestOption(null)).toBeNull();
  });
});

describe("quoting", () => {
  it("refuses to price carriage in pounds without a rate the shop chose", async () => {
    const { fetchImpl, calls } = fakeFetch({});
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fetchImpl });
    const quote = await adapter.quote({ lines, address });
    expect(quote.ok).toBe(false);
    if (quote.ok) return;
    expect(quote.reason).toMatch(/EUR/);
    /* Nothing was asked of BigBuy: a refusal should not be a network round trip. */
    expect(calls).toHaveLength(0);
  });

  it("asks for carriers by postcode and converts what comes back", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/rest/shipping/orders.json": { body: shippingPayload } });
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fetchImpl, toShopCurrency: (eur) => Math.round(eur * 0.85) });
    const quote = await adapter.quote({ lines, address });

    expect(quote).toMatchObject({ ok: true, shippingMinor: 612, currency: "GBP", etaDays: [4, 6] });
    expect(calls[0]).toMatchObject({
      url: "https://api.bigbuy.eu/rest/shipping/orders.json",
      method: "POST",
      headers: { Authorization: "Bearer k" },
    });
    expect(calls[0]!.body).toEqual({
      order: { delivery: { isoCountry: "GB", postcode: "LS1 1AA" }, products: [{ reference: "V0100100", quantity: 2 }] },
    });
  });

  it("says so when no carrier will take it", async () => {
    const { fetchImpl } = fakeFetch({ "/rest/shipping/orders.json": { body: { shippingOptions: [] } } });
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fetchImpl, toShopCurrency: (eur) => eur });
    const quote = await adapter.quote({ lines, address });
    expect(quote.ok).toBe(false);
    if (quote.ok) return;
    expect(quote.reason).toMatch(/no carrier/);
  });
});

describe("placing an order", () => {
  const checkOk = { body: { orders: [{ productReferences: ["V0100100"], total: 42.5, warehouse: 1 }], errors: [] } };

  it("checks, then creates, and keeps the supplier's references", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/rest/order/check/multishipping.json": checkOk,
      "/rest/order/create/multishipping.json": { body: { orders: [{ id: "15012345", warehouse: 1 }], errors: [] } },
    });
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fetchImpl, carriers: ["gls"] });
    const placed = await adapter.place({ orderId: "ord_cs_1", lines, address });

    expect(placed).toMatchObject({ ok: true, supplierReference: "15012345" });
    expect(calls.map((call) => call.method)).toEqual(["POST", "POST"]);
    expect(calls[0]!.url).toContain("/rest/order/check/multishipping.json");
    expect(calls[1]!.url).toContain("/rest/order/create/multishipping.json");
    expect(calls[0]!.headers.Authorization).toBe("Bearer k");
    expect(calls[1]!.body).toEqual({
      order: {
        internalReference: "ord_cs_1",
        language: "en",
        paymentMethod: "moneybox",
        carriers: [{ name: "gls" }],
        shippingAddress: {
          firstName: "Ada",
          lastName: "Lovelace",
          country: "GB",
          postcode: "LS1 1AA",
          town: "Leeds",
          address: "1 Example Street, Flat 2",
          phone: "+441130000000",
          email: "ada@example.com",
          comment: "",
        },
        products: [{ reference: "V0100100", quantity: 2 }],
      },
    });
  });

  it("keeps every warehouse order, not just the first", async () => {
    const { fetchImpl } = fakeFetch({
      "/rest/order/check/multishipping.json": checkOk,
      "/rest/order/create/multishipping.json": {
        body: { orders: [{ id: "15012345", warehouse: 1 }, { id: "15012346", warehouse: 2 }], errors: [] },
      },
    });
    const placed = await bigbuyAdapter({ apiKey: "k", fetch: fetchImpl }).place({ orderId: "ord_cs_1", lines, address });
    expect(placed).toEqual({ ok: true, supplierReference: "15012345", additionalReferences: ["15012346"] });
  });

  it("does not create an order the check refused", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/rest/order/check/multishipping.json": {
        body: { orders: [], errors: [{ status: 409, code: "ER003", message: '{"info":"Products have no stock.","data":{"skus":["V0100100"]}}' }] },
      },
    });
    const placed = await bigbuyAdapter({ apiKey: "k", fetch: fetchImpl }).place({ orderId: "ord_cs_1", lines, address });

    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.reason).toMatch(/out of stock/);
    expect(placed.retryable).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("calls a 500 retryable and a 400 not", async () => {
    const { fetchImpl } = fakeFetch({ "/rest/order/check/multishipping.json": { status: 500, body: {} } });
    const down = await bigbuyAdapter({ apiKey: "k", fetch: fetchImpl }).place({ orderId: "ord_cs_1", lines, address });
    expect(down).toMatchObject({ ok: false, retryable: true });

    const unauthorized = fakeFetch({ "/rest/order/check/multishipping.json": { status: 401, body: {} } });
    const wrongKey = await bigbuyAdapter({ apiKey: "k", fetch: unauthorized.fetchImpl }).place({ orderId: "ord_cs_1", lines, address });
    expect(wrongKey).toMatchObject({ ok: false, retryable: false });
  });

  it("refuses to call it placed when no id came back", async () => {
    const { fetchImpl } = fakeFetch({
      "/rest/order/check/multishipping.json": checkOk,
      "/rest/order/create/multishipping.json": { body: { orders: [], errors: [] } },
    });
    const placed = await bigbuyAdapter({ apiKey: "k", fetch: fetchImpl }).place({ orderId: "ord_cs_1", lines, address });
    expect(placed).toMatchObject({ ok: false, retryable: false });
  });
});

describe("tracking, because BigBuy cannot call us", () => {
  it("has no callback to parse", () => {
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fakeFetch({}).fetchImpl });
    expect(adapter.parseCallback({ anything: true })).toBeNull();
  });

  it("finds a tracking number wherever BigBuy put it", async () => {
    const { fetchImpl } = fakeFetch({
      "/rest/tracking/order/15012345.json": {
        body: { tracking: [{ carrierName: "GLS", trackingNumber: "GL123456789" }] },
      },
    });
    const adapter = bigbuyAdapter({ apiKey: "k", fetch: fetchImpl });
    const found = await adapter.tracking("15012345");
    if (!found.ok) throw new Error(found.reason);
    expect(found.tracking).toEqual([{ carrier: "GLS", number: "GL123456789", raw: { carrierName: "GLS", trackingNumber: "GL123456789" } }]);

    expect(trackingEvents(found.tracking, 1_700_000_000_000)).toEqual([
      { type: "shipped", at: 1_700_000_000_000, carrier: "GLS", trackingNumber: "GL123456789" },
    ]);
  });

  it("returns nothing rather than a guess when there is no number yet", async () => {
    const { fetchImpl } = fakeFetch({ "/rest/tracking/order/15012345.json": { body: { tracking: [] } } });
    const found = await bigbuyAdapter({ apiKey: "k", fetch: fetchImpl }).tracking("15012345");
    if (!found.ok) throw new Error(found.reason);
    expect(found.tracking).toEqual([]);
  });

  it("points at the sandbox when it is told to", async () => {
    const { fetchImpl, calls } = fakeFetch({ "/rest/tracking/order/1.json": { body: {} } });
    await bigbuyAdapter({ apiKey: "k", baseUrl: "https://api.sandbox.bigbuy.eu/", fetch: fetchImpl }).tracking("1");
    expect(calls[0]!.url).toBe("https://api.sandbox.bigbuy.eu/rest/tracking/order/1.json");
  });
});
