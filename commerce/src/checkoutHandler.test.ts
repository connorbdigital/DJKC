import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/checkout.js";
import { CATALOGUE } from "../lib/catalogue.js";

const product = CATALOGUE[0]!;

function request(body: unknown, method = "POST") {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    headers: { host: "shop.example", "x-forwarded-proto": "https" },
    async *[Symbol.asyncIterator]() {
      if (text) yield Buffer.from(text);
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

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.KV_REST_API_URL;
});

describe("the checkout function", () => {
  it("answers a GET with its own pulse, and names whether a key is set", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { res, out } = response();
    await handler(request(undefined, "GET"), res);
    const body = JSON.parse(out.body) as { checkout: string; key: string; catalogue: number; webhook: string; orders: string };
    expect(out.status).toBe(200);
    expect(body.checkout).toBe("alive");
    expect(body.key).toBe("missing");
    expect(body.catalogue).toBe(CATALOGUE.length);
    /* A key takes the money; without the other two, nobody is told. The pulse
       says both, so "checkout is broken" can be read instead of guessed. */
    expect(body.webhook).toBe("missing");
    expect(body.orders).toBe("no store");
    expect(spy).not.toHaveBeenCalled();
  });

  it("prices the basket and refuses honestly when no key is configured", async () => {
    const { res, out } = response();
    await handler(request({ items: [{ id: product.id, qty: 1 }] }), res);
    const body = JSON.parse(out.body) as { ok: boolean; configured: boolean; error: string; priced: { total: number } };
    expect(out.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.configured).toBe(false);
    expect(body.error).toContain("STRIPE_SECRET_KEY");
    expect(body.priced.total).toBeGreaterThan(0);
  });

  it("never reaches Stripe for a basket it cannot price", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { res, out } = response();
    await handler(request({ items: [{ id: "HG-NOPE", qty: 3 }] }), res);
    expect(out.status).toBe(400);
    expect(JSON.parse(out.body).error).toContain("HG-NOPE");
    expect(spy).not.toHaveBeenCalled();
  });

  it("posts a session to Stripe and hands back the payment link", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    const spy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }),
    }));
    vi.stubGlobal("fetch", spy);
    const { res, out } = response();
    await handler(request({ items: [{ id: product.id, qty: 2 }] }), res);
    const body = JSON.parse(out.body) as { ok: boolean; url: string };
    expect(out.status).toBe(200);
    expect(body.url).toContain("checkout.stripe.com");
    const [url, init] = spy.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: URLSearchParams }];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.headers.Authorization).toBe("Bearer sk_test_example");
    expect(init.body.get("line_items[0][quantity]")).toBe("2");
    expect(init.body.get("success_url")).toContain("shop.example");
  });

  it("passes Stripe's own complaint back rather than a bare status", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "Invalid API Key provided" } }),
      }))
    );
    const { res, out } = response();
    await handler(request({ items: [{ id: product.id, qty: 1 }] }), res);
    const body = JSON.parse(out.body) as { error: string; status: number };
    expect(out.status).toBe(502);
    expect(body.status).toBe(401);
    expect(body.error).toContain("Invalid API Key provided");
  });
});
