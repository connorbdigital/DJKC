import type { Capability } from "./types";

/**
 * The feature library. Every entry is something that already ships in one of
 * the projects — copied out of real code, not planned. Keep `manual` honest:
 * it is the list of things a PR cannot do for you.
 */
export const CAPABILITIES: Capability[] = [
  {
    id: "booking-form-deposits",
    name: "Booking form with Stripe deposits",
    summary:
      "A priced enquiry form: package selection, suggested budget, deposit or pay-in-full choice, Stripe Checkout, and a verified confirmation on return.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/bookings.ts", role: "Stores the request, validates fields, mints the payment link", adapt: true },
      { path: "api/deposit.ts", role: "Creates and verifies Stripe Checkout sessions" },
      { path: "src/components/Booking.tsx", role: "The form, pricing panel and confirmation cards", adapt: true },
      { path: "src/data.ts", role: "Tiers, prices, deposit helpers — copy the pricing constants only", adapt: true },
    ],
    env: ["STRIPE_SECRET_KEY", "STRIPE_DEPOSIT_PERCENT", "SITE_URL"],
    requires: ["storage"],
    manual: [
      "Replace the tiers and prices in the copied data file with this project's own",
      "Point the copy at your booking address and social links",
      "Decide the deposit percentage, or leave it at 50",
    ],
  },
  {
    id: "storage-kv",
    name: "Vercel KV storage layer",
    summary:
      "Thin wrapper over the KV REST API used by every other data feature: command(), hash pairing and constant-time token comparison. Each storage feature needs this first.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/store.ts", role: "command(), store(), pairsFromHash(), sameToken()" }],
    env: ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    requires: [],
    manual: ["Create a KV store in Vercel and connect it to the project"],
  },
  {
    id: "booking-desk",
    name: "Token-gated admin desk",
    summary:
      "A private single-page desk for requests and sign-ups: unlock with a token, search, change status, export CSV, manage blocked dates.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "public/admin.html", role: "The whole desk — no build step", adapt: true },
      { path: "api/store.ts", role: "Token comparison and storage helpers" },
    ],
    env: ["ADMIN_TOKEN"],
    requires: ["storage-kv"],
    manual: [
      "Change the endpoints the page calls to match your own routes",
      "Set ADMIN_TOKEN to a long random string",
    ],
  },
  {
    id: "mailing-list",
    name: "Database-backed mailing list",
    summary:
      "Subscribe endpoint with validation and rate limiting, a read/export/delete endpoint for the desk, and a delayed sign-up card for the site.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/subscribe.ts", role: "POST a sign-up, rate limited" },
      { path: "api/subscribers.ts", role: "GET/CSV/DELETE for GDPR removals" },
      { path: "src/components/UpdatesSignup.tsx", role: "Delayed, dismissible sign-up card", adapt: true },
    ],
    env: ["SUBSCRIBERS_TOKEN"],
    requires: ["storage-kv"],
    manual: [
      "Choose where the list should live long-term — a provider with unsubscribe links is the honest answer",
      "Update the copy in the sign-up card",
    ],
  },
  {
    id: "booking-chat",
    name: "Booking chat",
    summary:
      "A themed chat panel that answers booking questions and hands off to the enquiry form, with a serverless endpoint that rates-limits and fails safe.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/chat.ts", role: "Serverless reply endpoint" },
      { path: "src/components/BookingChat.tsx", role: "The panel, launcher and invitation card", adapt: true },
    ],
    env: ["CHAT_TOKEN", "OPENAI_API_KEY"],
    requires: [],
    manual: ["Rewrite the answer set for this project", "Add a real rate limiter before it faces the public"],
  },
  {
    id: "blocked-dates",
    name: "Blocked dates",
    summary: "Block holidays and holds so the public availability check steers enquiries elsewhere, managed from the desk.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "api/blocked.ts", role: "GET/POST/DELETE for blocked dates" },
      { path: "api/availability.ts", role: "Reports blocked before aggregating enquiries", adapt: true },
    ],
    env: [],
    requires: ["storage-kv", "booking-form-deposits"],
    manual: ["Add the Blocked dates tab to your desk"],
  },
  {
    id: "notifications",
    name: "Email notifications",
    summary: "Emails the desk when an enquiry lands, with reply-to set to the enquirer. Never blocks storage if mail fails.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/notify.ts", role: "Resend call with a short timeout" }],
    env: ["RESEND_API_KEY", "NOTIFY_EMAIL", "NOTIFY_FROM"],
    requires: ["booking-form-deposits"],
    manual: ["Verify the sending domain in Resend"],
  },
  {
    id: "calendar-feed",
    name: "Public calendar feed",
    summary: "A read-only iCalendar feed of upcoming dates, so the owner can subscribe to their own gig list.",
    source: "connorbdigital/DJKC",
    files: [{ path: "api/calendar.ts", role: "text/calendar response, escaped, no contact details", adapt: true }],
    env: [],
    requires: [],
    manual: ["Point it at your own dates source"],
  },
  {
    id: "static-seo-pages",
    name: "Crawlable static pages",
    summary:
      "Builds real HTML pages — prices, FAQs, dates, coverage — plus sitemap.xml and llms.txt from your data file, so search engines and answer bots can read the site without running JavaScript.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "scripts/build-static-pages.mts", role: "The generator", adapt: true },
      { path: "index.html", role: "noscript facts, JSON-LD, meta — copy the shape, not the content", adapt: true },
      { path: "public/robots.txt", role: "Sitemap line and answer-engine access", adapt: true },
    ],
    env: ["SITE_URL"],
    requires: [],
    manual: [
      "Add a postbuild script: node --experimental-strip-types scripts/build-static-pages.mts",
      "Replace the page bodies with this project's facts",
    ],
  },
  {
    id: "sticky-cta-bar",
    name: "Sticky booking bar",
    summary: "Phone-only bottom bar that appears past the hero, steps aside at the form, and preselects the deposit on tap.",
    source: "connorbdigital/DJKC",
    files: [
      { path: "src/components/BookBar.tsx", role: "The bar, its scroll logic and the pay-on-book event", adapt: true },
      { path: "src/index.css", role: "Styles plus the chat/sign-up offsets — copy the .kc-bookbar block", adapt: true },
    ],
    env: [],
    requires: [],
    manual: ["Check nothing else floats where the bar now sits"],
  },
  {
    id: "theme-colour",
    name: "Section-following browser colour",
    summary: "Updates the address-bar colour to the section in view, without touching the logo or favicon.",
    source: "connorbdigital/DJKC",
    files: [{ path: "src/utils/themeColor.ts", role: "Observer that writes theme-color", adapt: true }],
    env: [],
    requires: [],
    manual: ["Register your own section colours"],
  },
];

export const capabilityById = (id: string) => CAPABILITIES.find((c) => c.id === id);
