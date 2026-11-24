import { describe, expect, it } from "vitest";
import { add, clampAtZero, format, money, percentOf, subtract, sum, times, toDecimalString, vatIncluded } from "./money";

describe("money", () => {
  it("refuses decimals, so a price can never be 19.989999", () => {
    expect(() => money(19.99)).toThrow(/whole minor units/);
    expect(money(1999).amount).toBe(1999);
  });

  it("multiplies without floating point drift", () => {
    /* 19.99 * 3 in floats is 59.970000000000006. */
    expect(times(money(1999), 3).amount).toBe(5997);
    expect(toDecimalString(times(money(1999), 3))).toBe("59.97");
  });

  it("does arithmetic in one currency only", () => {
    expect(() => add(money(100, "GBP"), money(100, "EUR"))).toThrow(/Cannot combine/);
    expect(subtract(money(500), money(200)).amount).toBe(300);
    expect(sum([money(100), money(250), money(1)]).amount).toBe(351);
  });

  it("rounds a percentage to the nearest penny, half up", () => {
    expect(percentOf(money(8990), 10).amount).toBe(899);
    expect(percentOf(money(999), 12.5).amount).toBe(125);
    expect(percentOf(money(1), 50).amount).toBe(1);
  });

  it("never lets a discount take a basket below zero", () => {
    expect(clampAtZero(money(-250)).amount).toBe(0);
    expect(clampAtZero(money(250)).amount).toBe(250);
  });

  it("splits VAT out of a price that already includes it", () => {
    const { net, tax } = vatIncluded(money(12000), 20);
    expect(tax.amount).toBe(2000);
    expect(net.amount).toBe(10000);
    expect(net.amount + tax.amount).toBe(12000);
    const odd = vatIncluded(money(8990), 20);
    expect(odd.net.amount + odd.tax.amount).toBe(8990);
  });

  it("formats for a shopper and serialises for schema.org", () => {
    expect(format(money(8900)).replace(/\u00a0/g, " ")).toBe("£89.00");
    expect(toDecimalString(money(8900))).toBe("89.00");
    expect(toDecimalString(money(5))).toBe("0.05");
    expect(toDecimalString(money(100000))).toBe("1000.00");
  });
});
