/**
 * Three ways to make money from a product you do not make: refer it, resell it,
 * or list it on someone else's marketplace. They are not interchangeable, and
 * the percentages on the marketing pages are not the percentages you receive.
 *
 * This module holds the rates in one place so the copy, the arithmetic and the
 * pages cannot drift apart. Every figure carries the date it was checked and the
 * page it came from; when a network changes its terms, one object changes and
 * the tests fail loudly.
 */
import { money, type Money } from "./money";

export type RouteKind = "refer" | "resell" | "marketplace";

export interface Rate {
  /** The category as the programme names it, lower case. */
  category: string;
  percent: number;
}

export interface Programme {
  id: string;
  name: string;
  kind: RouteKind;
  url: string;
  /** What the shopper pays that you get a slice of, in one line. */
  basis: string;
  /** Category rates. The first entry is the default when nothing matches. */
  rates: Rate[];
  /** How long a click is credited for. Marketplaces have no cookie; they have a sale. */
  cookieDays?: number;
  /** A real ceiling on one attributed sale, where the programme publishes one. */
  cap?: { amount: Money; note: string };
  /** Things that must be true before the programme pays at all. */
  gates: string[];
  /** The part the programme's own page does not put in the headline. */
  catch: string;
  checked: string;
}

const GBP = "GBP" as const;

/**
 * Rates checked November 2026. Amazon and eBay publish ranges and pay the
 * category rate, not the number on the application form; AliExpress pays in USD
 * with a per-sale cap, which is the detail that turns a 5.4% headline into 1%.
 */
export const PROGRAMMES: Programme[] = [
  {
    id: "amazon-uk-associates",
    name: "Amazon UK Associates",
    kind: "refer",
    url: "https://affiliate-program.amazon.co.uk/",
    basis: "A percentage of the order the shopper places after your link, excluding VAT and returns",
    rates: [
      { category: "home", percent: 4 },
      { category: "kitchen", percent: 4 },
      { category: "garden", percent: 4 },
      { category: "diy", percent: 4 },
      { category: "lighting", percent: 4 },
      { category: "pet", percent: 4 },
      { category: "electronics", percent: 2.5 },
      { category: "fashion", percent: 5 },
    ],
    cookieDays: 1,
    gates: [
      "Approved account, then three qualifying sales in 180 days before the Product Advertising API works",
      "API access is the only way to keep prices and stock accurate at scale",
    ],
    catch:
      "The 24-hour cookie is the shortest of the three, and the API is gated behind sales you have not made yet — so the catalogue has to be written from a feed you already have, not from Amazon's.",
    checked: "2026-11",
  },
  {
    id: "aliexpress-portals",
    name: "AliExpress Portals",
    kind: "refer",
    url: "https://portals.aliexpress.com/",
    basis: "A percentage of the order value, capped per sale, paid in USD",
    rates: [
      { category: "home", percent: 5.4 },
      { category: "garden", percent: 5.4 },
      { category: "kitchen", percent: 5.4 },
      { category: "fashion", percent: 5.4 },
      { category: "electronics", percent: 3 },
      { category: "default", percent: 1.8 },
    ],
    cookieDays: 3,
    cap: { amount: money(3900, GBP), note: "US$50 per sale, converted at 0.79 — the cap is the programme's, the conversion is ours" },
    gates: [
      "UK traffic is paid at the lower end of the published range (1.8–5.4%), not the 9% the affiliate blogs quote",
      "Payout runs monthly after roughly 60 days of validation, with a US$16 minimum",
    ],
    catch:
      "A £900 order earns £39, not £48.60: the cap lands exactly where the commission gets interesting. Long delivery times also mean more returns, and returns are deducted.",
    checked: "2026-11",
  },
  {
    id: "ebay-partner-network",
    name: "eBay Partner Network",
    kind: "refer",
    url: "https://partnernetwork.ebay.co.uk/",
    basis: "A percentage of the final sale value, with a per-transaction ceiling",
    rates: [
      { category: "home", percent: 3 },
      { category: "garden", percent: 3 },
      { category: "fashion", percent: 4 },
      { category: "electronics", percent: 1.5 },
      { category: "default", percent: 1 },
    ],
    cookieDays: 1,
    cap: { amount: money(7900, GBP), note: "US$100 per transaction at the bottom of the published US$100–550 range, converted at 0.79" },
    gates: [
      "Approved EPN account; the flat 7.5% Ambassador rates are invite-only and for selected categories",
      "Only auctions and Buy It Now listings the network has categorised correctly are credited",
    ],
    catch:
      "1–4% on a 24-hour cookie is the weakest of the three for considered purchases like furniture, where the shopper browses for a week.",
    checked: "2026-11",
  },
  {
    id: "aosom-affiliate",
    name: "Aosom UK affiliate (via Awin)",
    kind: "refer",
    url: "https://www.aosom.co.uk/page/business",
    basis: "A percentage of the order, 30-day cookie — the best terms of the networks here",
    rates: [
      { category: "home", percent: 8 },
      { category: "garden", percent: 8 },
      { category: "pet", percent: 8 },
      { category: "diy", percent: 7 },
      { category: "beauty", percent: 7 },
      { category: "toys", percent: 10 },
      { category: "default", percent: 6 },
    ],
    cookieDays: 30,
    gates: ["Joined through Awin, with the merchant's approval", "Awin charges an override on top of network fees"],
    catch:
      "High rate, high average order value, and the same supplier whose trade file the catalogue is built from — so the pages can honestly say where the stock ships from.",
    checked: "2026-11",
  },
  {
    id: "alibaba",
    name: "Alibaba (sourcing, not affiliate)",
    kind: "resell",
    url: "https://www.alibaba.com/",
    basis: "No commission: you buy at a trade price and keep the difference, if there is one",
    rates: [],
    gates: [
      "Minimum order quantities, usually per colour or size",
      "You pay freight, duty and VAT at import; the trade price is not the landed cost",
      "You hold the stock, so you carry the returns and the dead lines",
    ],
    catch:
      "Not a product-connection route at all — it is a factory directory. The 'commission' is whatever margin survives freight, duty and a 60-day cash cycle, and for a single-unit order it is usually negative.",
    checked: "2026-11",
  },
  {
    id: "ebay-uk-seller",
    name: "eBay UK (as a seller)",
    kind: "marketplace",
    url: "https://www.ebay.co.uk/",
    basis: "You keep the sale price minus final value fees on the total including postage",
    rates: [
      { category: "home", percent: 11.9 },
      { category: "garden", percent: 10.9 },
      { category: "toys", percent: 10.9 },
      { category: "default", percent: 10.9 },
    ],
    gates: ["Business account", "30p per order (40p over £10) plus a 0.35% regulatory fee, all plus VAT"],
    catch: "Fees apply to the postage too, so 'free delivery' is charged commission as well as carriage.",
    checked: "2026-11",
  },
  {
    id: "amazon-seller",
    name: "Amazon UK (as a seller)",
    kind: "marketplace",
    url: "https://sell.amazon.co.uk/",
    basis: "You keep the sale price minus the referral fee, which is charged on the total",
    rates: [
      { category: "home", percent: 15 },
      { category: "kitchen", percent: 15 },
      { category: "garden", percent: 15 },
      { category: "default", percent: 15 },
    ],
    gates: ["£25/month professional account unless you sell under 35 items", "FBA fulfilment fees on top if you use them"],
    catch: "15% is the headline; with the subscription, storage and returns it is the most expensive of the three.",
    checked: "2026-11",
  },
  {
    id: "the-range-marketplace",
    name: "The Range Marketplace",
    kind: "marketplace",
    url: "https://marketplace.therange.co.uk/",
    basis: "You keep the sale price minus commission on the total including delivery",
    rates: [
      { category: "home", percent: 13 },
      { category: "garden", percent: 14 },
      { category: "toys", percent: 11 },
      { category: "pet", percent: 11 },
      { category: "default", percent: 13 },
    ],
    gates: ["No monthly or listing fee — no sale, no fee", "98% on-time despatch and under 1% cancellation, or penalties"],
    catch: "Commission may not be returned when an order is refunded, so a return costs you twice.",
    checked: "2026-11",
  },
];

export const programmeById = (id: string): Programme => {
  const found = PROGRAMMES.find((programme) => programme.id === id);
  if (!found) throw new Error(`No programme called "${id}". Known: ${PROGRAMMES.map((entry) => entry.id).join(", ")}`);
  return found;
};

const rateFor = (programme: Programme, category?: string): Rate => {
  const wanted = category?.toLowerCase();
  const exact = wanted && programme.rates.find((rate) => rate.category === wanted);
  if (exact) return exact;
  return programme.rates.find((rate) => rate.category === "default") ?? programme.rates[0]!;
};

/**
 * What one sale is actually worth to you. Capped, because the cap is the whole
 * point on AliExpress and eBay, and rounded down, because networks do.
 */
export function payout(
  programme: Programme,
  orderTotal: Money,
  category?: string
): { commission: Money; percent: number; capped: boolean; capNote?: string } {
  if (programme.kind !== "refer") {
    throw new Error(`${programme.name} is a ${programme.kind} route, not an affiliate programme. There is no commission to compute.`);
  }
  if (orderTotal.currency !== GBP) {
    throw new Error(`Rates here are quoted for GBP orders; got ${orderTotal.currency}. Convert first, then decide which rate applies.`);
  }
  const rate = rateFor(programme, category);
  const gross = Math.floor((orderTotal.amount * rate.percent) / 100);
  if (programme.cap && gross > programme.cap.amount.amount) {
    return { commission: money(programme.cap.amount.amount, GBP), percent: rate.percent, capped: true, capNote: programme.cap.note };
  }
  return { commission: money(gross, GBP), percent: rate.percent, capped: false };
}

/** The honest number behind an affiliate page: clicks × conversion × order × rate. */
export function referralValue(
  programme: Programme,
  input: { clicks: number; conversionRate: number; averageOrder: Money; category?: string }
): { sales: number; commission: Money; perClick: Money } {
  if (input.clicks < 0) throw new Error("Clicks cannot be negative.");
  if (input.conversionRate <= 0 || input.conversionRate > 1) {
    throw new Error(`Conversion rate is a fraction, not a percentage; got ${input.conversionRate}.`);
  }
  const sales = Math.floor(input.clicks * input.conversionRate);
  const one = payout(programme, input.averageOrder, input.category);
  const commission = money(sales * one.commission.amount, GBP);
  const perClick = money(input.clicks ? Math.floor(commission.amount / input.clicks) : 0, GBP);
  return { sales, commission, perClick };
}

/**
 * The resale arithmetic from COMMISSION.md, in code: retail minus VAT, trade,
 * carriage, card fees and a returns provision. Integer pence throughout, and
 * the VAT is divided rather than subtracted at 20% of the gross, because that is
 * the mistake that makes a losing product look profitable.
 */
export function resaleNet(input: {
  retail: Money;
  trade: Money;
  carriage: Money;
  returnsProvision?: Money;
  feePercent?: number;
  feeFixed?: Money;
}): { net: Money; netRevenue: Money; marginPercent: number } {
  const { retail, trade, carriage } = input;
  if (retail.currency !== GBP || trade.currency !== GBP || carriage.currency !== GBP) {
    throw new Error("Resale arithmetic is GBP-only here; convert before you compare.");
  }
  const netRevenue = money(Math.round(retail.amount / 1.2), GBP);
  const feePercent = input.feePercent ?? 1.5;
  const feeFixed = input.feeFixed ?? money(20, GBP);
  const fees = Math.round((retail.amount * feePercent) / 100) + feeFixed.amount;
  const returns = input.returnsProvision?.amount ?? 50;
  const net = netRevenue.amount - trade.amount - carriage.amount - fees - returns;
  return { net: money(net, GBP), netRevenue, marginPercent: Math.round((net / netRevenue.amount) * 1000) / 10 };
}

export type Route = RouteKind;

/**
 * The decision, not the vocabulary. Free traffic plus a small basket is a
 * referral business; free traffic plus a £60+ basket and a 3× markup is a shop;
 * no traffic at all means renting someone else's.
 */
export function routeFor(input: {
  averageOrder: Money;
  markupMultiple: number;
  hasFreeTraffic: boolean;
}): { route: Route; because: string } {
  const { averageOrder, markupMultiple, hasFreeTraffic } = input;
  if (!hasFreeTraffic) {
    return {
      route: "marketplace",
      because:
        "Without traffic of your own, paid clicks cost more than either route pays: a marketplace commission is cheaper than an ad that has to earn back the whole margin.",
    };
  }
  if (averageOrder.amount >= 6000 && markupMultiple >= 3) {
    return {
      route: "resell",
      because: "A £60+ basket at a 3× markup carries carriage, fees and returns and still leaves a margin worth keeping.",
    };
  }
  return {
    route: "refer",
    because:
      "Under a £60 basket or below a 3× markup, the margin after carriage and returns is thinner than the affiliate commission on the same sale — and referral carries no stock risk.",
  };
}

/** The same sale, both ways, for the price list. */
export function compareRoute(programme: Programme, input: {
  retail: Money;
  trade: Money;
  carriage: Money;
  category?: string;
}): { referred: Money; resold: Money; winner: Route; difference: Money } {
  const referred = payout(programme, input.retail, input.category).commission;
  const resold = resaleNet({ retail: input.retail, trade: input.trade, carriage: input.carriage }).net;
  const difference = money(Math.abs(referred.amount - resold.amount), GBP);
  return { referred, resold, winner: referred.amount >= resold.amount ? "refer" : "resell", difference };
}

/** A table for the docs, generated from the same numbers the tests check. */
export function routeTable(): string {
  const rows = PROGRAMMES.map((programme) => {
    const percents = programme.rates.map((entry) => entry.percent);
    const low = Math.min(...percents);
    const high = Math.max(...percents);
    const rate = !percents.length ? "margin, not commission" : low === high ? `${low}%` : `${low}–${high}%`;
    const cookie = programme.cookieDays ? `${programme.cookieDays} day${programme.cookieDays === 1 ? "" : "s"}` : "n/a";
    return `| ${programme.name} | ${programme.kind} | ${rate} | ${cookie} | ${programme.cap ? programme.cap.note : "none"} |`;
  });
  return [
    "| Programme | Route | Rate | Cookie | Per-sale cap |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}
