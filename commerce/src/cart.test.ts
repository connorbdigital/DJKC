import { describe, expect, it } from "vitest";
import { addToCart, emptyCart, itemCount, priceCart, setQuantity, stockConflicts, type Discount, type ShippingRule } from "./cart";
import { money } from "./money";
import { hoodie, tote } from "./fixtures";

const products = [hoodie(), tote()];
const shipping: ShippingRule = { freeOver: money(5000), flat: money(399), label: "Standard", estimate: "2–3 working days" };
const discounts: Discount[] = [
  { code: "TEN", kind: "percent", value: 10, maxDiscount: money(1500) },
  { code: "TENNER", kind: "fixed", value: 1000, minSpend: money(8000) },
  { code: "BAGS", kind: "percent", value: 20, categories: ["Bags"] },
];

describe("cart", () => {
  it("prices a basket including delivery, before any checkout step", () => {
    const cart = addToCart(emptyCart(), "TOTE-NAT", 2);
    const priced = priceCart(cart, { products, shipping });
    expect(priced.subtotal.amount).toBe(4800);
    expect(priced.shipping.amount).toBe(399);
    expect(priced.total.amount).toBe(5199);
    expect(itemCount(cart)).toBe(2);
  });

  it("drops delivery to nil at the threshold, and says how far away it is", () => {
    const under = priceCart(addToCart(emptyCart(), "TOTE-NAT", 1), { products, shipping });
    expect(under.message).toMatch(/Add 26\.00 more for free delivery/);

    const over = priceCart(addToCart(emptyCart(), "HOOD-CHR-S", 1), { products, shipping });
    expect(over.shipping.amount).toBe(0);
    expect(over.total.amount).toBe(8900);
  });

  it("keeps VAT inside the shelf price rather than adding it", () => {
    const priced = priceCart(addToCart(emptyCart(), "HOOD-CHR-S", 1), { products, shipping });
    expect(priced.total.amount).toBe(8900);
    expect(priced.taxIncluded.amount).toBe(1483);
    expect(priced.total.amount).toBe(8900);
  });

  it("caps a percentage code and refuses one below its minimum spend", () => {
    const capped = priceCart({ ...addToCart(emptyCart(), "HOOD-CHR-M", 1), discountCode: "TN" }, { products, discounts });
    expect(capped.discountRejected).toMatch(/not a valid code/);

    const ten = priceCart({ ...addToCart(emptyCart(), "HOOD-CHR-M", 2), discountCode: "ten" }, { products, discounts });
    expect(ten.subtotal.amount).toBe(17800);
    expect(ten.discount.amount).toBe(1500); // 10% would be 1780, capped at 1500

    const below = priceCart({ ...addToCart(emptyCart(), "TOTE-NAT", 1), discountCode: "TENNER" }, { products, discounts });
    expect(below.discount.amount).toBe(0);
    expect(below.discountRejected).toMatch(/needs a basket/);
  });

  it("applies a code only to the categories it names", () => {
    const cart = { ...addToCart(addToCart(emptyCart(), "TOTE-NAT", 1), "HOOD-CHR-S", 1), discountCode: "BAGS" };
    const priced = priceCart(cart, { products, discounts });
    expect(priced.discount.amount).toBe(480); // 20% of the £24 tote, not the hoodie
    expect(priced.subtotal.amount).toBe(11300);
    expect(priced.total.amount).toBe(10820);
    expect(priced.shipping.amount).toBe(0);
  });

  it("never charges less than nothing", () => {
    const cart = { ...addToCart(emptyCart(), "TOTE-NAT", 1), discountCode: "TENNER" };
    const priced = priceCart(cart, { products, discounts: [{ code: "TENNER", kind: "fixed", value: 100000 }] });
    expect(priced.discount.amount).toBe(2400);
    expect(priced.total.amount).toBe(0);
  });

  it("reports stock honestly instead of quietly reducing the order", () => {
    const cart = addToCart(emptyCart(), "HOOD-CHR-S", 9); // only 4 left
    const priced = priceCart(cart, { products });
    expect(priced.lines).toHaveLength(0);
    expect(stockConflicts(priced)[0]?.detail).toMatch(/Only 4/);
    expect(priced.message).toMatch(/Only 4/);
  });

  it("drops a line that is no longer sold rather than pricing it at zero", () => {
    const priced = priceCart({ currency: "GBP", lines: [{ sku: "GONE", quantity: 1 }] }, { products });
    expect(priced.issues[0]?.problem).toBe("unknown-sku");
    expect(priced.total.amount).toBe(0);
    expect(priced.message).toMatch(/no longer sold/);
  });

  it("handles quantity changes and removal", () => {
    const cart = addToCart(emptyCart(), "TOTE-NAT", 1);
    expect(setQuantity(cart, "TOTE-NAT", 3).lines[0]?.quantity).toBe(3);
    expect(setQuantity(cart, "TOTE-NAT", 0).lines).toHaveLength(0);
    expect(addToCart(cart, "TOTE-NAT", 1).lines[0]?.quantity).toBe(2);
  });

  it("says something useful on an empty basket", () => {
    const priced = priceCart(emptyCart(), { products, shipping });
    expect(priced.total.amount).toBe(0);
    expect(priced.message).toBe("Your basket is empty.");
  });
});
