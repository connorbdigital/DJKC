import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/stripe-webhook.js";
import { CATALOGUE } from "../lib/catalogue.js";

/**
 * The endpoint itself, wired the way Vercel wires it: env in, KV over fetch,
 * bytes in, JSON out. This is the test that would have caught the import path,
 * the header casing and the body reading — the three things that fail in
 * production rather than in a unit test.
 */

const SECRET = "whsec_endpoint_test";
const product = CATALOGUE.find((entry) => entry.available)!;

function request(body: string, signature?: string) {
  return {
    method: "POST",
    headers: {
      host: "shop.example",
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body);
    },
  } as unknown as Parameters<typeof handler>[0];
}

function response() {
  const out = { status: 0, body: "", headers: {} as Record<string, string> };
  const res = {
    headersSent: false,
    set statusCode(value: number) {
      out.status = value;
    },
    get statusCode() {
      return out.status;
    },
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
    },
    end(chunk: string) {
      out.body = chunk;
      res.headersSent = true;
    },
  };
  return { res: res as unknown as Parameters<typeof handler>[1], out };
}

const session = {
  id: "cs_test_endpoint",
  payment_status: "paid",
  payment_intent: "pi_test_endpoint",
  amount_total: product.priceMinor,
  metadata: { cart: `${product.id}x1` },
  customer_details: { email: "buyer@example.com", name: "A Buyer" },
  collected_information: {
    shipping_details: { name: "A Buyer", address: { line1: "1 Example Street", city: "Leeds", postcode: "LS1 1AA", country: "GB" } },
  },
};

const payloadFor = (object: Record<string, unknown>, type = "checkout.session.completed") =>
  JSON.stringify({ id: "evt_endpoint", type, data: { object } });

const signFor = (body: string) => {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;
};

/** A KV that stores what it is told, in memory, and answers GET/SET. */
function kv() {
  const data = new Map<string, string>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const [verb, key, value] = JSON.parse(String(init.body)) as [string, string, string?];
      if (verb === "SET") {
        data.set(key, value ?? "");
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: data.get(key) ?? null }), { status: 200 });
    }),
  );
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.SUPPLIER_NAME;
  delete process.env.BIGBUY_API_KEY;
});

describe("the webhook endpoint", () => {
  it("takes a signed payment and records the order in the store", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "t";
    const data = kv();

    const body = payloadFor(session);
    const { res, out } = response();
    await handler(request(body, signFor(body)), res);

    expect(out.status).toBe(200);
    expect(out.headers["content-type"]).toContain("application/json");
    const parsed = JSON.parse(out.body) as { ok: boolean; orderId: string; status: string; next: string };
    expect(parsed).toMatchObject({ ok: true, orderId: "ord_cs_test_endpoint", status: "paid", next: "submit" });

    const saved = JSON.parse(data.get("order:ord_cs_test_endpoint")!) as { status: string; lines: { id: string }[] };
    expect(saved.status).toBe("paid");
    expect(saved.lines[0]!.id).toBe(product.id);
    expect(data.get("intent:pi_test_endpoint")).toBe("ord_cs_test_endpoint");
  });

  it("answers 400 to an unsigned post and writes nothing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "t";
    const data = kv();

    const { res, out } = response();
    await handler(request(JSON.stringify({ hello: "there" })), res);

    expect(out.status).toBe(400);
    expect(data.size).toBe(0);
  });

  it("says what is missing, rather than accepting money it cannot record", async () => {
    const body = payloadFor(session);

    const noSecret = response();
    await handler(request(body, "t=1,v1=deadbeef"), noSecret.res);
    expect(noSecret.out.status).toBe(503);
    expect(JSON.parse(noSecret.out.body).error).toMatch(/STRIPE_WEBHOOK_SECRET/);

    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    vi.stubGlobal("fetch", vi.fn());
    const noStore = response();
    await handler(request(body, signFor(body)), noStore.res);
    expect(noStore.out.status).toBe(503);
    expect(JSON.parse(noStore.out.body).error).toMatch(/No order store/);
  });
});
