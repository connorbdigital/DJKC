import { describe, expect, it } from "vitest";
import { DELIVERY, basketNote, priceBasket, requestedLines, sessionBody, shippingFor } from "../api/pricing.js";
import { CATALOGUE } from "../lib/catalogue.js";

const shelf = CATALOGUE.find((product) => product.name === "Bamboo folding shelf rack") ?? CATALOGUE[0]!;
const mug = CATALOGUE.find((product) => product.name === "Stoneware mug set of four") ?? CATALOGUE[1]!;

describe("pricing a basket on the server", () => {
  it("prices from the catalogue it was given, never from the request", () => {
    const priced = priceBasket(CATALOGUE, [{ id: shelf.id, qty: 2 }]);
    expect(priced.ok).toBe(true);
    expect(priced.lines[0]!.unitMinor).toBe(shelf.priceMinor);
    expect(priced.lines[0]!.lineMinor).toBe(shelf.priceMinor * 2);
  });

  it("merges duplicate lines and clamps what a browser can ask for", () => {
    const merged = requestedLines([
      { id: shelf.id, qty: 1 },
      { id: shelf.id, qty: 2 },
      { id: "", qty: 3 },
      { id: shelf.id, qty: 999 },
      { id: shelf.id, qty: -5 },
    ]);
    expect(merged).toEqual([{ id: shelf.id, qty: 10 }]);
  });

  it("refuses an id that is not in the catalogue, and says which", () => {
    const priced = priceBasket(CATALOGUE, [{ id: "HG-NOPE", qty: 1 }]);
    expect(priced.ok).toBe(false);
    expect(priced.problems[0]).toContain("HG-NOPE");
    expect(priced.lines).toHaveLength(0);
  });

  it("refuses an empty basket rather than charging for delivery", () => {
    const priced = priceBasket(CATALOGUE, []);
    expect(priced.ok).toBe(false);
    expect(priced.total).toBe(0);
    expect(priced.problems).toContain("The basket is empty.");
  });

  it("applies free delivery over the threshold and nowhere else", () => {
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(3999)).toBe(DELIVERY.standard);
    expect(shippingFor(4000)).toBe(0);
    expect(shippingFor(9000)).toBe(0);
    const small = priceBasket(CATALOGUE, [{ id: mug.id, qty: 1 }]);
    const big = priceBasket(CATALOGUE, [{ id: shelf.id, qty: 4 }]);
    expect(small.total).toBe(small.subtotal + DELIVERY.standard);
    expect(big.total).toBe(big.subtotal);
  });

  it("says the delivery rule in a sentence a customer can act on", () => {
    const small = priceBasket(CATALOGUE, [{ id: mug.id, qty: 1 }]);
    expect(basketNote(small)).toMatch(/standard delivery/i);
    const big = priceBasket(CATALOGUE, [{ id: shelf.id, qty: 4 }]);
    expect(basketNote(big)).toMatch(/Free delivery/);
  });

  it("writes the Stripe session as form keys, with delivery as its own line", () => {
    const priced = priceBasket(CATALOGUE, [{ id: shelf.id, qty: 1 }]);
    const body = sessionBody({
      lines: priced.lines,
      shipping: priced.shipping,
      baseUrl: "https://shop.example",
      successPath: "/pages/order-complete.html",
      cancelPath: "/shop.html?cancelled=1",
    });
    expect(body.get("mode")).toBe("payment");
    expect(body.get("success_url")).toContain("{CHECKOUT_SESSION_ID}");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe(String(shelf.priceMinor));
    expect(body.get("line_items[1][price_data][product_data][name]")).toMatch(/delivery/i);
    expect(body.get("shipping_address_collection[allowed_countries][0]")).toBe("GB");
    expect(body.get("line_items[0][price_data][currency]")).toBe("gbp");
  });

  it("keeps the shop and the checkout reading the same prices", () => {
    /* The generated catalogue is the CSV through another door: every product has
       a price, a stock answer and an image, and none of them is zero. */
    expect(CATALOGUE.length).toBeGreaterThan(20);
    for (const product of CATALOGUE) {
      expect(product.priceMinor).toBeGreaterThan(0);
      expect(product.name.length).toBeGreaterThan(3);
      expect(product.image).toMatch(/^assets\/.+\.svg$/);
      expect(typeof product.available).toBe("boolean");
    }
    expect(new Set(CATALOGUE.map((product) => product.id)).size).toBe(CATALOGUE.length);
  });
});
