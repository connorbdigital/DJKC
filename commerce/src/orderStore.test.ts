import { describe, expect, it, vi } from "vitest";
import { kvConfig, kvStore, memoryStore, orderIdForSession, orderKey, intentKey, storeFromEnv } from "./orderStore";
import { newOrder, type Order } from "./orders";
import type { OrderAddress } from "./orders";

const address: OrderAddress = {
  name: "A Buyer",
  line1: "1 Example Street",
  town: "Leeds",
  postcode: "LS1 1AA",
  country: "GB",
  email: "buyer@example.com",
};

const order = (id = "ord_cs_1"): Order => ({
  ...newOrder({
    id,
    at: 1_000,
    lines: [{ id: "HG-1001", supplierSku: "HG-SHELF-01", title: "Shelf", quantity: 1, unitMinor: 4_999 }],
    shippingMinor: 395,
    address,
    supplier: "BigBuy",
  }),
  paymentIntentId: "pi_test_1",
});

describe("the in-memory store", () => {
  it("keeps an order and finds it by payment intent", async () => {
    const store = memoryStore();
    await store.put(order());
    expect((await store.get("ord_cs_1"))?.id).toBe("ord_cs_1");
    expect((await store.findByPaymentIntent("pi_test_1"))?.id).toBe("ord_cs_1");
    expect(await store.get("ord_missing")).toBeNull();
    expect(await store.findByPaymentIntent("pi_missing")).toBeNull();
  });
});

describe("the Upstash store", () => {
  it("is configured by either set of variable names, and needs both", () => {
    expect(kvConfig({ KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://kv.example", token: "t" });
    expect(kvConfig({ UPSTASH_REDIS_REST_URL: "https://up.example/", UPSTASH_REDIS_REST_TOKEN: "t" })).toEqual({ url: "https://up.example", token: "t" });
    expect(kvConfig({ KV_REST_API_URL: "https://kv.example" })).toBeNull();
    expect(storeFromEnv({})).toBeNull();
  });

  it("writes the order and the intent index under predictable keys", async () => {
    const calls: { args: unknown[] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push({ args: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }),
    );

    const store = kvStore({ url: "https://kv.example", token: "t" });
    await store.put(order());
    vi.unstubAllGlobals();

    expect(calls.map((call) => call.args[0])).toEqual(["SET", "SET"]);
    expect(calls[0]!.args[1]).toBe(orderKey("ord_cs_1"));
    expect(JSON.parse(String(calls[0]!.args[2])).id).toBe("ord_cs_1");
    expect(calls[1]!.args).toEqual(["SET", intentKey("pi_test_1"), "ord_cs_1"]);
  });

  it("reads an order back, and copes with an empty or broken value", async () => {
    const responses = ["", "{not json", JSON.stringify(order())];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: responses.shift() }), { status: 200 })),
    );
    const store = kvStore({ url: "https://kv.example", token: "t" });
    expect(await store.get("a")).toBeNull();
    expect(await store.get("b")).toBeNull();
    expect((await store.get("c"))?.id).toBe("ord_cs_1");
    vi.unstubAllGlobals();
  });

  it("resolves an intent to its order", async () => {
    const responses = ["ord_cs_1", JSON.stringify(order())];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: responses.shift() }), { status: 200 })),
    );
    const store = kvStore({ url: "https://kv.example", token: "t" });
    expect((await store.findByPaymentIntent("pi_test_1"))?.id).toBe("ord_cs_1");
    vi.unstubAllGlobals();
  });

  it("throws rather than pretending a write happened", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const store = kvStore({ url: "https://kv.example", token: "t" });
    await expect(store.put(order())).rejects.toThrow(/500/);
    vi.unstubAllGlobals();
  });
});

describe("the session id", () => {
  it("gives the same order id to the same session, so a retry lands on the same order", () => {
    expect(orderIdForSession("cs_test_a1")).toBe(orderIdForSession("cs_test_a1"));
    expect(orderIdForSession("cs_test_a1")).not.toBe(orderIdForSession("cs_test_a2"));
  });
});
