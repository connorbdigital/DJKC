/**
 * The pitch sheet: a live page in, a one-page argument out.
 *
 * The audit already says what is wrong. A pitch sheet says what it **costs**,
 * what to fix first, and what the fix is worth — because "your site fails five
 * checks" is a complaint, and "£2,000 of orders a month is leaking out of your
 * product pages" is a reason to reply.
 *
 * Everything here is pure: `buildPitch` takes a report and returns a sheet, and
 * `pitchText` turns the sheet into something that can be pasted into an email.
 * The prices are the four packages in docs/sitebuildup-clients-2026-11-20.md.
 */

import type { SiteCheck, SiteReport } from "./sitecheck";

export interface Offer {
  id: string;
  name: string;
  price: string;
  what: string;
}

export const OFFERS: Offer[] = [
  {
    id: "one-page",
    name: "One page",
    price: "£600",
    what: "A single page that does one job: the offer, the proof, the enquiry form, on brand, in a week.",
  },
  {
    id: "site",
    name: "The site",
    price: "£1,800",
    what: "5–8 pages, real copy editing, the four legal pages, analytics with consent, a Google Business Profile, handover.",
  },
  {
    id: "shop",
    name: "The shop",
    price: "£4,500",
    what: "The site, plus a catalogue feed, basket, Stripe checkout, delivery rules and the first month of stock sync.",
  },
  {
    id: "alive",
    name: "Keeping it alive",
    price: "£60/month",
    what: "Hosting, updates, one change a month, and a monthly report that says what happened.",
  },
];

/**
 * What each failure costs, in money the owner recognises. These are judgements,
 * not measurements — which is why they are written as consequences to check
 * rather than as numbers to quote.
 */
const COST: Record<string, string> = {
  title: "every result and share card shows the wrong words, so the click goes to whoever wrote theirs",
  description: "the sentence a buyer reads before clicking is missing, so the listing looks thinner than it is",
  h1: "the page has no stated subject, so both a reader and a crawler guess",
  product: "price, stock and rating are invisible to search and to the assistants people now ask instead of searching",
  offer: "nothing can compare the price automatically, so the page drops out of shopping results",
  returns: "return terms are read before buying; without them the basket is abandoned at the last step",
  images: "screen-reader users cannot tell what is for sale, and it is the most common accessibility failure in retail",
  viewport: "a phone shows a desktop page squeezed into a phone screen — most visitors leave before scrolling",
  canonical: "the same page counts several times, splitting whatever ranking it has",
  social: "every shared link is a naked sentence instead of a card, so it is shared less",
  content: "there is almost nothing on the page for a search engine to rank or an assistant to quote",
  speed: "the page arrives late on a phone, and a late page is a lost visit",
};

/** The order they are fixed in: what loses money first. */
const ORDER = ["viewport", "content", "title", "description", "product", "offer", "returns", "images", "canonical", "social", "h1", "speed"];

export interface Finding {
  id: string;
  label: string;
  status: SiteCheck["status"];
  detail: string;
  /** What it costs, in a sentence an owner will recognise. */
  cost: string;
}

export interface Pitch {
  url: string;
  /** The one sentence the whole sheet is arguing. */
  headline: string;
  score: number;
  passes: number;
  findings: Finding[];
  /** Three things, in the order they should happen. */
  fixes: { title: string; why: string }[];
  offer: Offer;
  companion: Offer;
  /** The audit's own verdict, in its own words. */
  checked: string;
  /** The day it was read, so a sheet sent in March cannot be mistaken for May. */
  date: string;
}

const FIXES: Record<string, { title: string; why: string }> = {
  viewport: { title: "Make it work on a phone first", why: "most visits are a phone on a slow connection, and this is the cheapest fix on the list." },
  content: { title: "Write the page a customer would read", why: "400 words of plain description beats any amount of tuning: it is what gets quoted." },
  title: { title: "Rewrite the title and description", why: "they are what a result, a share card and an AI answer say about the business." },
  description: { title: "Write the description as a sentence", why: "70–155 characters: what it is, where it is, why it is better." },
  product: { title: "Add product or service structured data", why: "price, stock and returns in JSON-LD, so search and shopping surfaces can read it." },
  offer: { title: "Publish a price, in the page and in the markup", why: "a page with no price cannot be compared, and is quietly skipped." },
  returns: { title: "State the returns policy on the page", why: "it is read before buying, and it is expected in a product feed." },
  images: { title: "Describe every image", why: "alt text, written as the product, not as \"image\"." },
  canonical: { title: "Declare one URL per page", why: "it stops filters and trailing slashes competing with the page itself." },
  social: { title: "Give every page a share card", why: "an og:image and a title, so a shared link looks like the business." },
  h1: { title: "One headline per page", why: "the subject, in one line, at the top." },
  speed: { title: "Slim the page down", why: "fewer scripts, sized images, and the page arrives while the visitor is still there." },
};

/** Advice that is right for almost every small site, used to fill the plan out. */
const STANDING: { title: string; why: string }[] = [
  { title: "Claim the Google Business Profile", why: "it is free, it is what a map search shows, and it is where reviews collect." },
  { title: "Put three real photographs and a price on the page", why: "buyers want to see the thing and what it costs before they will ring." },
  { title: "Ask the last three customers for a review", why: "reviews are the proof a stranger uses to decide, and they keep working for years." },
];

const weight = (status: SiteCheck["status"]) => (status === "fail" ? 2 : status === "warn" ? 1 : 0);

/** Does the page look like it is trying to sell something? */
const sells = (report: SiteReport): boolean =>
  report.jsonLd.some((type) => /Product|Offer|ItemList|Store/i.test(type)) ||
  /\b(shop|store|basket|cart|checkout|buy|price|products?)\b/i.test(`${report.title} ${report.description}`);

/**
 * Which package the findings actually point at. The rule is deliberately blunt:
 * commerce evidence plus a broken commerce check means the shop; a page whose
 * problems are spelling-out-what-you-do means one page; everything else the site.
 */
export function offerFor(report: SiteReport): { offer: Offer; companion: Offer } {
  const ids = new Set(report.checks.filter((check) => check.status !== "pass").map((check) => check.id));
  const shopSignals = ["product", "offer", "returns"].filter((id) => ids.has(id)).length;
  if (sells(report) && shopSignals >= 1) return { offer: OFFERS[2]!, companion: OFFERS[3]! };
  if (ids.size === 0) return { offer: OFFERS[1]!, companion: OFFERS[3]! };
  if (ids.size <= 3 && ["content", "title", "description"].some((id) => ids.has(id))) {
    return { offer: OFFERS[0]!, companion: OFFERS[1]! };
  }
  return { offer: OFFERS[1]!, companion: OFFERS[3]! };
}

export function buildPitch(report: SiteReport, url = report.url): Pitch {
  const failing = report.checks.filter((check) => check.status !== "pass");
  const ranked = [...failing].sort((a, b) => weight(b.status) - weight(a.status) || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const passes = report.checks.filter((check) => check.status === "pass").length;
  const score = Math.round((passes / Math.max(1, report.checks.length)) * 100);
  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  const findings: Finding[] = ranked.slice(0, 5).map((check) => ({
    id: check.id,
    label: check.label,
    status: check.status,
    detail: check.detail,
    cost: COST[check.id] ?? check.because,
  }));

  const fixes = ranked
    .slice(0, 3)
    .map((check) => FIXES[check.id] ?? { title: `Fix ${check.label.toLowerCase()}`, why: check.because });

  /* Three steps, always: a sheet that ends after one line reads like a formality.
     The padding is standing advice, not a claim about this page. */
  for (const step of STANDING) {
    if (fixes.length >= 3) break;
    if (fixes.some((fix) => fix.title === step.title)) continue;
    fixes.push(step);
  }

  const { offer, companion } = offerFor(report);
  const headline = !failing.length
    ? `${host} passes all ${report.checks.length} checks. The next job is not fixing it — it is being found: search, proof, and a route to enquire.`
    : failing.length === 1
      ? `${host} passes ${passes} of ${report.checks.length} checks — and the one that is failing is the one that costs orders.`
      : `${host} passes ${passes} of ${report.checks.length} checks — and the ${failing.length} that are failing are the ones that cost orders.`;

  return {
    url,
    headline,
    score,
    passes,
    findings,
    fixes,
    offer,
    companion,
    checked: report.verdict,
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };
}

const line = (value: string) => value.replace(/\s+/g, " ").trim();

/** The sheet, as something that can be pasted into an email without tidying. */
export function pitchText(pitch: Pitch): string {
  const parts = [
    pitch.headline,
    "",
    pitch.findings.length ? "What is wrong, worst first:" : "Nothing is failing.",
    ...pitch.findings.map((finding, index) => `${index + 1}. ${line(finding.label)} — ${line(finding.detail)} ${line(finding.cost).replace(/^./, (c) => c.toUpperCase())}.`),
    "",
    "What to do, in this order:",
    ...pitch.fixes.map((fix, index) => `${index + 1}. ${line(fix.title)} — ${line(fix.why)}`),
    "",
    `${pitch.offer.name} (${pitch.offer.price}): ${pitch.offer.what}`,
    `${pitch.companion.name} (${pitch.companion.price}): ${pitch.companion.what}`,
    "",
    `Checked on ${pitch.date} — ${pitch.checked.replace(/^./, (c) => c.toLowerCase())}`,
    "",
    "— SiteBuildup · https://kaysie.sitebuildup.co.uk",
  ];
  return parts.join("\n");
}
