export * from "./money";
export * from "./catalog";
export * from "./search";
export * from "./cart";
export * from "./checkout";
export * from "./seo";
export * from "./budget";
export * from "./affiliate";
export * from "./siteModel";

/**
 * The framework in one sentence, exported so the README and the code cannot
 * drift: a shop wins on the failures the market leaders still have — a
 * checkout that hides costs, a mobile page that cannot paint, a search that
 * dead-ends, markup an agent cannot read, and a flow a keyboard cannot finish.
 */
export const FRAMEWORK = {
  name: "KC Commerce",
  version: "0.1.0",
  thesis:
    "Compete on the five failures the leaders still have: checkout friction, mobile speed, dead-end search, unreadable structured data, and inaccessible flows.",
  nonNegotiables: [
    "Guest checkout, twelve form elements at most",
    "Delivery and tax priced before payment, never at it",
    "Money as integer minor units, VAT shown inside the price",
    "Product pages that render without JavaScript, with complete Offer markup",
    "Search that tolerates a typo and never returns an empty page",
    "WCAG 2.2 AA, checked in CI rather than promised",
  ],
  limits: [
    "No payment provider integration: take the order, hand off to Stripe or a PSP",
    "No hosting or deployment opinion beyond static-first pages",
    "No customer accounts, PIM or ERP sync",
  ],
} as const;
