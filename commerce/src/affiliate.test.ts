import { describe, expect, it } from "vitest";
import { money } from "./money";
import {
  PROGRAMMES,
  compareRoute,
  payout,
  programmeById,
  referralValue,
  resaleNet,
  routeFor,
  routeTable,
} from "./affiliate";

describe("the rate table", () => {
  it("covers every route the shop can take, with the date it was checked", () => {
    expect(PROGRAMMES.length).toBeGreaterThanOrEqual(6);
    for (const programme of PROGRAMMES) {
      expect(programme.checked, programme.id).toMatch(/^\d{4}-\d{2}$/);
      expect(programme.url, programme.id).toMatch(/^https:\/\//);
      expect(programme.gates.length, programme.id).toBeGreaterThan(0);
      expect(programme.catch.length, programme.id).toBeGreaterThan(40);
    }
    expect(new Set(PROGRAMMES.map((entry) => entry.kind))).toEqual(new Set(["refer", "resell", "marketplace"]));
  });

  it("says which programmes are gate-kept behind sales you have not made", () => {
    const amazon = programmeById("amazon-uk-associates");
    expect(amazon.gates.join(" ")).toMatch(/three qualifying sales in 180 days/);
    expect(amazon.cookieDays).toBe(1);
  });
});

describe("what a sale is worth", () => {
  it("pays the category rate, not the headline range", () => {
    const amazon = programmeById("amazon-uk-associates");
    expect(payout(amazon, money(4999), "home").commission).toEqual(money(199));
    expect(payout(amazon, money(4999), "electronics").commission).toEqual(money(124));
    expect(payout(amazon, money(4999), "something else").commission).toEqual(money(199));
  });

  it("applies the AliExpress cap, which is where the 5.4% headline dies", () => {
    const aliexpress = programmeById("aliexpress-portals");
    const small = payout(aliexpress, money(5000), "home");
    expect(small.commission).toEqual(money(270));
    expect(small.capped).toBe(false);

    const large = payout(aliexpress, money(90_000), "home");
    expect(large.capped).toBe(true);
    expect(large.commission).toEqual(money(3900));
    expect(large.capNote).toMatch(/US\$50/);
  });

  it("caps eBay per transaction and pays the lower UK rate, not the Ambassador 7.5%", () => {
    const ebay = programmeById("ebay-partner-network");
    expect(payout(ebay, money(20_000), "home").commission).toEqual(money(600));
    expect(payout(ebay, money(300_000), "home")).toMatchObject({ commission: money(7900), capped: true });
  });

  it("refuses to compute a commission on a route that has none", () => {
    expect(() => payout(programmeById("alibaba"), money(4999))).toThrow(/not an affiliate programme/);
    expect(() => payout(programmeById("amazon-seller"), money(4999))).toThrow(/marketplace route/);
  });

  it("refuses to mix currencies rather than guessing a rate", () => {
    expect(() => payout(programmeById("aosom-affiliate"), money(4999, "EUR"))).toThrow(/GBP orders/);
  });
});

describe("the arithmetic behind an affiliate page", () => {
  it("turns clicks into money honestly: 100 clicks, 3%, £80 basket at 8%", () => {
    const value = referralValue(programmeById("aosom-affiliate"), {
      clicks: 100,
      conversionRate: 0.03,
      averageOrder: money(8000),
      category: "garden",
    });
    expect(value.sales).toBe(3);
    expect(value.commission).toEqual(money(1920));
    expect(value.perClick).toEqual(money(19));
  });

  it("rejects a conversion rate written as a percentage", () => {
    expect(() =>
      referralValue(programmeById("aosom-affiliate"), { clicks: 10, conversionRate: 3, averageOrder: money(8000) })
    ).toThrow(/fraction/);
  });

  it("works out resale net the way the doc does, including the VAT division", () => {
    const net = resaleNet({
      retail: money(4999),
      trade: money(3200),
      carriage: money(450),
      returnsProvision: money(50),
    });
    expect(net.netRevenue).toEqual(money(4166));
    expect(net.net).toEqual(money(371));
    expect(net.marginPercent).toBe(8.9);
  });

  it("compares the two routes on the same £49.99 sale and says which wins", () => {
    const comparison = compareRoute(programmeById("aosom-affiliate"), {
      retail: money(4999),
      trade: money(3200),
      carriage: money(450),
      category: "home",
    });
    expect(comparison.referred).toEqual(money(399));
    expect(comparison.resold).toEqual(money(371));
    expect(comparison.winner).toBe("refer");
    expect(comparison.difference).toEqual(money(28));
  });
});

describe("the decision", () => {
  it("refers a small basket even when traffic is free", () => {
    expect(routeFor({ averageOrder: money(4999), markupMultiple: 3.2, hasFreeTraffic: true })).toMatchObject({ route: "refer" });
  });

  it("resells a £60+ basket at a 3× markup", () => {
    expect(routeFor({ averageOrder: money(12_000), markupMultiple: 3.4, hasFreeTraffic: true })).toMatchObject({ route: "resell" });
  });

  it("rents a marketplace when there is no traffic at all", () => {
    const decision = routeFor({ averageOrder: money(12_000), markupMultiple: 4, hasFreeTraffic: false });
    expect(decision.route).toBe("marketplace");
    expect(decision.because).toMatch(/advert|ad /);
  });

  it("publishes a table that matches the objects", () => {
    const table = routeTable();
    expect(table.split("\n")[0]).toBe("| Programme | Route | Rate | Cookie | Per-sale cap |");
    expect(table).toContain("Amazon UK Associates");
    expect(table).toContain("US$50 per sale");
    expect(table.split("\n").length).toBe(PROGRAMMES.length + 2);
  });
});
