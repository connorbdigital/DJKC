import type { Capability, Category } from "./types";

/**
 * The feature library. Every entry is something that already ships in one of
 * the projects — copied out of real code, not planned. Keep `manual` honest:
 * it is the list of things a PR cannot do for you.
 */
export const CAPABILITIES: Capability[] = [
  {
    id: "booking-form-deposits",
    category: "bookings",
    version: "1.0.1",
    name: "Booking form with Stripe deposits",
    summary:
      "A priced enquiry form: package selection, suggested budget, deposit or pay-in-full choice, Stripe Checkout, and a verified confirmation on return.",
    why:
      "This is the only place on the site where money moves, and everything else points at it. A priced form plus a deposit turns a vague enquiry into a held date: people who pay something turn up, and the price is agreed before the first message.",
    without:
      "Enquiries arrive as unstructured texts and DMs, two people can hold the same Saturday, and the price gets negotiated twice. Nothing records what was quoted.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/bookings.ts", role: "Stores the request, validates fields, mints the payment link", adapt: true },
      { path: "api/deposit.ts", role: "Creates and verifies Stripe Checkout sessions" },
      { path: "src/components/Booking.tsx", role: "The form, pricing panel and confirmation cards", adapt: true },
      { path: "src/components/Reveal.tsx", role: "The scroll-in wrapper the form's sections use" },
      { path: "src/components/Icons.tsx", role: "The icon set those sections use" },
      { path: "src/utils/dates.ts", role: "Date formatting and the minimum lead time" },
      { path: "src/data.ts", role: "Tiers, prices, deposit helpers — copy the pricing constants only", adapt: true },
    ],
    expects: [
      { path: "api/notify.ts", role: "emails the desk when an enquiry lands — the notifications feature carries it" },
    ],
    env: ["STRIPE_SECRET_KEY", "STRIPE_DEPOSIT_PERCENT", "SITE_URL"],
    requires: ["storage-kv"],
    manual: [
      "Replace the tiers and prices in the copied data file with this project's own",
      "Point the copy at your booking address and social links",
      "Decide the deposit percentage, or leave it at 50",
    ],
  },
  {
    id: "storage-kv",
    category: "storage",
    version: "1.0.0",
    name: "Vercel KV storage layer",
    summary:
      "Thin wrapper over the KV REST API used by every other data feature: command(), hash pairing and constant-time token comparison. Each storage feature needs this first.",
    why:
      "Every feature that remembers anything — enquiries, blocked dates, sign-ups — writes here. It is the difference between a site that collects and a site that forgets.",
    without:
      "Enquiries exist only in whatever mailbox caught them. The desk, the availability check and the mailing list all have nothing to read, so each feature silently stops working.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/store.ts", role: "command(), store(), pairsFromHash(), sameToken()" }],
    expects: [],
    env: ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    requires: [],
    manual: ["Create a KV store in Vercel and connect it to the project"],
  },
  {
    id: "booking-desk",
    category: "operations",
    version: "1.0.0",
    name: "Token-gated admin desk",
    summary:
      "A private single-page desk for requests and sign-ups: unlock with a token, search, change status, export CSV, manage blocked dates.",
    why:
      "Bookings are a job after the enquiry lands: quoting, confirming, blocking a date, deleting someone who asks. The desk is where that happens without a database console.",
    without:
      "Records can only be read by whoever holds the KV token. Nobody can change a status or honour a deletion request, and an erasure request becomes a manual job with a deadline.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "public/admin.html", role: "The whole desk — no build step", adapt: true },
      { path: "api/store.ts", role: "Token comparison and storage helpers" },
    ],
    expects: [],
    env: ["ADMIN_TOKEN"],
    requires: ["storage-kv"],
    manual: [
      "Change the endpoints the page calls to match your own routes",
      "Set ADMIN_TOKEN to a long random string",
    ],
  },
  {
    id: "mailing-list",
    category: "marketing",
    version: "1.0.1",
    name: "Database-backed mailing list",
    summary:
      "Subscribe endpoint with validation and rate limiting, a read/export/delete endpoint for the desk, and a delayed sign-up card for the site.",
    why:
      "Repeat customers are a small share of buyers but a large share of revenue — around a fifth of buyers producing well over a third of sales in the studies behind this library. The list is the cheapest second booking there is.",
    without:
      "The site takes a booking and then loses the relationship. The only way back to that person is paid advertising, or hoping they remember the URL.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/subscribe.ts", role: "POST a sign-up, rate limited" },
      { path: "api/subscribers.ts", role: "GET/CSV/DELETE for GDPR removals" },
      { path: "src/components/UpdatesSignup.tsx", role: "Delayed, dismissible sign-up card", adapt: true },
      { path: "src/components/Icons.tsx", role: "The close and mail icons the card uses" },
    ],
    expects: [{ path: "src/data.ts", role: "the sign-up copy — your own content" }],
    env: ["SUBSCRIBERS_TOKEN"],
    requires: ["storage-kv"],
    manual: [
      "Choose where the list should live long-term — a provider with unsubscribe links is the honest answer",
      "Update the copy in the sign-up card",
    ],
  },
  {
    id: "booking-chat",
    category: "bookings",
    version: "1.1.0",
    name: "Booking chat",
    summary:
      "A themed chat panel that answers booking questions and hands off to the enquiry form, with a serverless endpoint that rates-limits and fails safe.",
    why:
      "Most pre-booking questions are the same dozen: deposit, travel, what is included. Answering them inside the page keeps people from leaving to ask in a DM, where the answer is neither searchable nor saved.",
    without:
      "The same questions arrive by hand every week, and anyone who will not fill in a form leaves without asking at all.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/chat.ts", role: "Serverless reply endpoint" },
      { path: "src/rateLimit.ts", role: "The per-visitor limit the endpoint spends against" },
      { path: "src/components/BookingChat.tsx", role: "The panel, launcher and invitation card", adapt: true },
      { path: "src/bookingGuide.ts", role: "The answer set — rewrite these for this business", adapt: true },
      { path: "src/components/Logo.tsx", role: "The mark in the header — swap in your own", adapt: true },
      { path: "src/components/Icons.tsx", role: "The icon set the panel uses" },
    ],
    expects: [{ path: "src/data.ts", role: "tiers and copy the guide answers with — your own content" }],
    env: ["CHAT_TOKEN", "OPENAI_API_KEY"],
    requires: [],
    manual: ["Rewrite the answer set for this project", "Set the allowance to what one conversation costs you — twenty a minute is this project's guess"],
  },
  {
    id: "blocked-dates",
    category: "operations",
    version: "1.0.0",
    name: "Blocked dates",
    summary: "Block holidays and holds so the public availability check steers enquiries elsewhere, managed from the desk.",
    why:
      "Availability is the one fact people check before they enquire. Blocking holidays is what keeps that check honest.",
    without:
      "The site invites enquiries for dates the owner cannot work. A wrong yes is worse than a slow one: it has to be taken back.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/blocked.ts", role: "GET/POST/DELETE for blocked dates" },
      { path: "api/availability.ts", role: "Reports blocked before aggregating enquiries", adapt: true },
    ],
    expects: [],
    env: [],
    requires: ["storage-kv", "booking-form-deposits"],
    manual: ["Add the Blocked dates tab to your desk"],
  },
  {
    id: "notifications",
    category: "operations",
    version: "1.0.0",
    name: "Email notifications",
    summary: "Emails the desk when an enquiry lands, with reply-to set to the enquirer. Never blocks storage if mail fails.",
    why:
      "An enquiry is only worth having if it is seen while the person is still interested. Email is the alert that does not depend on anyone opening a dashboard.",
    without:
      "Requests sit in storage until someone remembers to look. By then the enquirer has usually booked elsewhere.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/notify.ts", role: "Resend call with a short timeout" }],
    expects: [],
    env: ["RESEND_API_KEY", "NOTIFY_EMAIL", "NOTIFY_FROM"],
    requires: ["booking-form-deposits"],
    manual: ["Verify the sending domain in Resend"],
  },
  {
    id: "calendar-feed",
    category: "operations",
    version: "1.0.1",
    name: "Public calendar feed",
    summary: "A read-only iCalendar feed of upcoming dates, so the owner can subscribe to their own gig list.",
    why:
      "One subscription keeps the owner's own phone calendar in step with what the site publishes, so dates are entered once.",
    without:
      "Dates live in two places and drift apart. The site advertises a date that has already moved, which is the fastest way to lose trust.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/calendar.ts", role: "text/calendar response, escaped, no contact details", adapt: true }],
    expects: [{ path: "src/data.ts", role: "the dates the feed publishes — your own content" }],
    env: [],
    requires: [],
    manual: ["Point it at your own dates source"],
  },
  {
    id: "static-seo-pages",
    category: "search",
    version: "1.2.0",
    name: "Crawlable static pages",
    summary:
      "Builds real HTML pages — prices, FAQs, dates, coverage — plus sitemap.xml and llms.txt from your data file, so search engines and answer bots can read the site without running JavaScript.",
    why:
      "Search is where a large share of buying starts — commonly quoted at 40–60% of shoppers going straight to a search box or engine — and answer engines only quote pages they can read without running JavaScript. The generated pages are how the site gets found at all.",
    without:
      "The site is a single JavaScript page: crawlers index a shell, AI assistants have nothing to quote, and every price, date and FAQ is invisible to the thing people now ask first.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "scripts/build-static-pages.mts", role: "The generator", adapt: true },
      { path: "src/eventTypes.ts", role: "One entry per kind of booking: answer-first copy, facts, questions", adapt: true },
      { path: "src/components/Occasions.tsx", role: "The homepage block that links every generated page", adapt: true },
      { path: "src/components/Reveal.tsx", role: "The scroll-in wrapper that block uses" },
      { path: "index.html", role: "noscript facts, JSON-LD, meta — copy the shape, not the content", adapt: true },
      { path: "public/robots.txt", role: "Sitemap line and answer-engine access", adapt: true },
      { path: "src/trading.ts", role: "The trader identity, retention periods and postal-address fallback the terms and privacy pages print", adapt: true },
    ],
    expects: [{ path: "src/data.ts", role: "the facts the generated pages are built from — your own content" }],
    env: ["SITE_URL"],
    requires: [],
    manual: [
      "Add a postbuild script: node --experimental-strip-types scripts/build-static-pages.mts",
      "Replace the page bodies with this project's facts",
      "Give every kind of booking its own entry in src/eventTypes.ts — one page per buyer, not one page listing all of them",
    ],
  },
  {
    id: "sticky-cta-bar",
    category: "design",
    version: "1.0.1",
    name: "Sticky booking bar",
    summary: "Phone-only bottom bar that appears past the hero, steps aside at the form, and preselects the deposit on tap.",
    why:
      "On a phone the booking button is off-screen for most of the page. The bar keeps the action one tap away, and steps aside at the form so it never covers the thing it is advertising.",
    without:
      "Most visitors are on a phone, scroll the whole page, and leave without ever seeing the button. Enquiry rate drops without any error being logged.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "src/components/BookBar.tsx", role: "The bar, its scroll logic and the pay-on-book event", adapt: true },
      { path: "src/index.css", role: "Styles plus the chat/sign-up offsets — copy the .kc-bookbar block", adapt: true },
      { path: "src/components/Icons.tsx", role: "The phone and calendar icons in the bar" },
    ],
    expects: [{ path: "src/data.ts", role: "DEPOSIT_PERCENT and chargeFor, used by the pay-on-book tap" }],
    env: [],
    requires: [],
    manual: ["Check nothing else floats where the bar now sits"],
  },
  {
    id: "theme-colour",
    category: "design",
    version: "1.0.0",
    name: "Section-following browser colour",
    summary: "Updates the address-bar colour to the section in view, without touching the logo or favicon.",
    why:
      "Small polish: browser chrome follows the section, so screenshots and shared links look deliberate. It never touches the logo or the favicon.",
    without:
      "Nothing breaks. The site simply looks less considered in the browsers that support it — which is most of them.",
    source: "connorbdigital/DJKC",
    files: [{ path: "src/utils/themeColor.ts", role: "Observer that writes theme-color", adapt: true }],
    expects: [],
    env: [],
    requires: [],
    manual: ["Register your own section colours"],
  },
  {
    id: "store-core",
    category: "store",
    version: "1.0.0",
    name: "Storefront core: prices, catalogue, cart, checkout audit",
    summary:
      "Integer-penny money, a product and variant model with a completeness validator, typo-tolerant search that never dead-ends, a cart that prices discounts and delivery deterministically, a guest-first checkout audit, and performance and accessibility budgets that fail a build.",
    why:
      "Every shop rebuilds the same four mistakes: prices in floating point, a cart nobody can explain, a checkout with twenty fields, and a product page that search engines and shopping agents cannot read. This is that layer, written once, with the argument for each decision attached.",
    without:
      "Totals drift by a penny between components, delivery and discount maths is duplicated in the UI, and there is no way to say why checkout converts badly because nothing measures it.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "commerce/src/money.ts", role: "Integer minor units, VAT-inclusive prices, one formatter" },
      { path: "commerce/src/catalog.ts", role: "Product and variant model, plus the validator agents read", adapt: true },
      { path: "commerce/src/search.ts", role: "Typo-tolerant search index, with a fallback for zero results" },
      { path: "commerce/src/cart.ts", role: "Discounts, delivery and stock truth, priced in one place" },
      { path: "commerce/src/checkout.ts", role: "The guest-first checkout as a spec, and an audit that fails loudly", adapt: true },
      { path: "commerce/src/seo.ts", role: "Product, Offer and ReturnPolicy JSON-LD, breadcrumbs, FAQ, llms.txt" },
      { path: "commerce/src/budget.ts", role: "Performance and accessibility budgets that fail a build" },
      { path: "commerce/src/siteModel.ts", role: "Delivery promises, stock labels, key facts, related products, page titles and the FAQs answer engines read" },
      { path: "commerce/src/affiliate.ts", role: "Affiliate and marketplace rates as typed data: payout with caps, referral value, resale net, the route decision" },
      { path: "commerce/catalogue/site.ts", role: "Brand, currency, delivery promises and the twelve-department taxonomy — the shop's config", adapt: true },
      { path: "commerce/src/fixtures.ts", role: "Two example products — delete these once yours are in" },
      { path: "commerce/src/index.ts", role: "The barrel file, so imports stay short" },
      { path: "commerce/GAPS.md", role: "What a real store has that this does not — the backlog, in order" },
    ],
    expects: [],
    env: [],
    requires: [],
    manual: [
      "Add vitest and run the tests before wiring it into a UI — they are the point",
      "Replace fixtures.ts with your own products, or import them from a supplier CSV",
      "Decide who takes payment: the framework prices an order, it does not charge one",
      "Read GAPS.md and pick the first gap deliberately rather than discovering it in production",
    ],
  },
  {
    id: "supplier-catalogue",
    category: "store",
    version: "1.0.0",
    name: "Product catalogue from a supplier CSV",
    summary:
      "A supplier CSV parser, column maps for four real feed shapes, per-row repair reporting, a Google Merchant feed exporter, and a build that turns the file into static product pages with structured data, llms.txt and a sitemap.",
    why:
      "Products arrive as a spreadsheet from a wholesaler, and the shop has to become real pages search engines and agents can read. Importing it by hand is a week; importing it by script is a minute, and the issues report tells you which rows will fail before a customer finds them.",
    without:
      "Someone retypes fifty products into a CMS, the descriptions stay supplier boilerplate, the Merchant feed gets rejected for missing images, and the pages do not exist until a front end is built.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "commerce/src/csv.ts", role: "Quoted fields, BOMs, CRLF, ragged rows and messy headers" },
      { path: "commerce/src/importProducts.ts", role: "Four supplier column maps, price/stock coercion, per-row issues", adapt: true },
      { path: "commerce/src/exportFeed.ts", role: "Google Merchant feed, products.json, sitemap" },
      { path: "commerce/catalogue/site.ts", role: "The brand, twelve departments and the aliases that map supplier categories onto them", adapt: true },
      { path: "commerce/catalogue/render.ts", role: "The CSS, the basket JavaScript and every page component the build assembles" },
      { path: "commerce/catalogue/scripts/build-site.mts", role: "CSV → the whole shop: home, departments, product pages, schema, feed, llms.txt, sitemap, robots", adapt: true },
      { path: "commerce/catalogue/products.csv", role: "A worked example in a trade-feed shape — replace it", adapt: true },
      { path: "commerce/catalogue/scripts/serve.mjs", role: "A static server for previewing the built catalogue" },
      { path: "commerce/src/feedSource.ts", role: "Feed URL checks, redaction, and what arrived in the file" },
      { path: "commerce/scripts/fetch-feed.mts", role: "Downloads a supplier feed, dates it, keeps a redacted manifest" },
      { path: "commerce/feeds/README.md", role: "How to download a feed without leaking the account" },
      { path: "commerce/SUPPLIERS.md", role: "Where to get the CSV: suppliers, links, costs, vetting questions" },
      { path: "commerce/COMMISSION.md", role: "What the money is: margin, marketplace commission, affiliate rates, and the four product-source routes" },
    ],
    expects: [],
    env: [],
    requires: ["store-core"],
    manual: [
      "Run npm run feed against the URL your supplier gives you, then npm run site on the file it saved",
      "npm run serve:catalogue and read the home page on a phone before publishing anything",
      "Read the issues list before publishing — every 'no GTIN' or 'repaired' line is a product that would fail later",
      "Rewrite every supplier description — duplicate copy is the fastest way to be invisible",
      "Replace the generated placeholder images with photography you have the rights to use",
      "Add the build to CI so the catalogue cannot drift from the feed",
      "Confirm VAT treatment and stock freshness for the supplier you chose",
    ],
  },
];

export const capabilityById = (id: string) => CAPABILITIES.find((c) => c.id === id);

export interface CategoryInfo {
  id: Category;
  label: string;
  blurb: string;
  /** Why the shelf exists — what would be missing from the site without it. */
  why: string;
}

/** The shelves, in the order they are shown. */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: "bookings",
    label: "Bookings & enquiries",
    blurb: "Taking the enquiry, quoting it, and answering questions before it.",
    why: "This is the shelf that makes money: the form, the deposit, the answers that stop people leaving. Everything else exists to feed it or to run what it produces.",
  },
  {
    id: "operations",
    label: "Running the desk",
    blurb: "What happens after somebody says yes: the desk, holds, alerts, the calendar.",
    why: "A booking that is not run becomes a complaint. These are the processes that keep the diary true after the enquiry lands.",
  },
  {
    id: "marketing",
    label: "Marketing",
    blurb: "Keeping in touch — the list, the sign-up card, the reasons to come back.",
    why: "Getting one booking is expensive; getting the second from the same person is nearly free. This shelf is how the site earns a second visit.",
  },
  {
    id: "store",
    label: "Store & catalogue",
    blurb: "Selling things: prices, a catalogue, a cart, feeds and the pages products live on.",
    why: "A shop is a catalogue plus arithmetic plus a payment. This shelf is the first two: pricing that is exact, products a search engine and an AI agent can read, and a supplier spreadsheet that becomes a store instead of a spreadsheet.",
  },
  {
    id: "design",
    label: "Design & conversion",
    blurb: "How it looks and how it nudges: colour, the booking bar, the small mechanics.",
    why: "Small mechanics with measurable effect: the action stays reachable, the page looks finished, nothing floats over the form.",
  },
  {
    id: "search",
    label: "Search & AI answers",
    blurb: "Being found and being quoted: real HTML pages, sitemaps, structured data.",
    why: "Being found and being quotable are now the same job. Static pages are read by crawlers and assistants; a JavaScript-only page is not.",
  },
  {
    id: "storage",
    label: "Data & storage",
    blurb: "The boring layer everything else stands on.",
    why: "No storage, no memory. Every other shelf depends on this one, which is why it is the first thing installed into a new project.",
  },
];

export const categoryInfo = (id: Category) => CATEGORIES.find((entry) => entry.id === id);

/** Capabilities on one shelf, in library order. */
export const inCategory = (id: Category) => CAPABILITIES.filter((entry) => entry.category === id);

/** How many features sit on each shelf — used for the filter chips. */
export const categoryCounts = (): Record<Category, number> =>
  CATEGORIES.reduce(
    (counts, entry) => ({ ...counts, [entry.id]: inCategory(entry.id).length }),
    {} as Record<Category, number>
  );
