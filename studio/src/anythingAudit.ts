/**
 * The brief this Studio sends when it asks Anything to change a project.
 *
 * Kept here rather than in the docs because this is the copy that travels: the
 * Studio builds it, the bridge posts it, and Anything's agent reads it. The
 * long-form version with the evidence behind each line is
 * `docs/anything-prompt-digital-solutions-agency.md`; the two are checked against
 * each other by a test so the brief cannot drift from the audit quietly.
 *
 * Written for an agent, not for a reader: no preamble, an order, and acceptance
 * checks at the end, because an agent that cannot verify its own work stops
 * early.
 */

export interface Brief {
  /** What to send. */
  prompt: string;
  /** The audit it comes from, for the record. */
  source: string;
  /** The things the brief must not lose, asserted by the test. */
  nonNegotiables: string[];
}

export const APEX_AUDIT_BRIEF: Brief = {
  source: "docs/sitebuildup-apex-audit-2026-11-20.md",
  /* Written as the brief writes them, because the test checks the exact string:
     a near-miss here is a finding that fell out of the brief in an edit. */
  nonNegotiables: [
    "ONE IDENTITY",
    "ONE PRICE LIST",
    "every placeholder",
    "robots.txt",
    "0+",
    "DMCC",
  ],
  prompt: [
    "You are fixing the existing agency website published at sitebuildup.co.uk (project: digital solutions agency).",
    "Do not rebuild it from scratch and do not change the dark visual language. Work in this order; do not skip ahead.",
    "",
    "1. ONE IDENTITY. One trading name (SiteBuildUp), one email (hello@sitebuildup.com), one phone, one postal address, one complaints route, held in a single config module and printed in the footer of every page and on /contact, /privacy, /terms, /cookies.",
    "Delete everywhere: hello@digital-solutions.uk, hello@digitalsolutions.co.uk, privacy@yourcompany.com, legal@yourcompany.com, 0203 627 4444, and 020 7946 0958 (that one is Ofcom's reserved drama range and can never be answered).",
    "",
    "2. ONE PRICE LIST. Create src/data/business.ts exporting BUSINESS and PRICING; every price on / , /pricing, /services, each /services/* page, the bundle maths, the meta copy and the schema renders from PRICING.",
    "Resolve these conflicts with these defaults: SEO Starter GBP 797/mo, SEO Growth 1,497/mo, SEO Dominate 2,997/mo; Starter Website 995 one-off, Professional 2,495, Enterprise 5,995; App Starter 6,995; AI Starter 2,995; E-Commerce Starter 1,995.",
    "Delete the GBP 160/240/280 retainers and the 'from GBP 795' hero line. Show every price as including VAT, or print 'ex VAT' beside it — never only in the terms.",
    "",
    "3. LEGAL PAGES THAT ARE NOT TEMPLATES. Rewrite /privacy, /terms, /cookies from the config. Remove every placeholder: [Your Business Address], [Your Phone Number], [Your Jurisdiction], yourcompany.com.",
    "Terms must state delivery windows, payment schedule, one cancellation/refund policy, one guarantee (not three), the liability cap, IP on full payment, England & Wales law.",
    "Cookies: delete 'by using our website you consent'; add consent before any non-essential script, listing each cookie by name, purpose and duration; if none are set, say so.",
    "",
    "4. EVERY ROUTE GETS ITS OWN HEAD. Per-route title (under 60 characters), description, canonical, og:title/description/image, for /, /services, all 13 /services/* pages, /pricing, /about, /contact, /book-consultation, /blog, every post, /privacy, /terms, /cookies.",
    "No two pages may share a title. Exactly one h1 per page. Fix 'Drive Traffic & BoostSales With SEO' to 'SEO & Digital Marketing' and 'Websites, apps &  AI that pays for itself.' to one correctly spaced sentence.",
    "",
    "5. CRAWLERS GET THE SAME SITE AS PEOPLE. Generate /robots.txt (allow GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended; reference the sitemap), /sitemap.xml from the route table, and /llms.txt with who we are, prices, the six service URLs and the contact block.",
    "Render services, prices and FAQ as HTML in the first response, not only after hydration. /book-consultation must say without JavaScript: what the call is, how long, that it costs nothing, what happens next, and the phone/email alternative.",
    "Schema: LocalBusiness site-wide; Service + Offer with the real price per service page; FAQPage per service page; Article + author (a named person with a bio) + datePublished/dateModified per post; BreadcrumbList on service and blog pages.",
    "",
    "6. TRUTH IN NUMBERS. Wire the homepage counters to real values and render the final number server-side — they currently display 0+, 0%, 0%, 0+.",
    "One claim per metric across the whole site and in schema. Delete 750+, 500+, 312% ROI, 98% and GBP 2M+ unless the owner confirms them in config.",
    "Publish a review rating only where it links to the live profile; no link, no number. Replace the three stock 'success stories' (TechStart Solutions, Local Home Services, E-commerce Fashion) and the invented logo wall with entries from src/data/work.ts, or an honest empty state. Invented testimonials are illegal under the DMCC Act 2024.",
    "/about: remove the four initials-only team members unless each has a real photo and LinkedIn URL.",
    "",
    "7. FOUR MISSING PAGES. /work (case studies with live URL, one dated metric and how it was measured), /faq (15-20 answer-first questions grouped by service, with FAQPage schema), /process (eight steps with week numbers, what the client provides, the guarantee as policy), and a /contact that shows the address block, phone, hours, a response-time promise and a privacy line with an unchecked marketing consent.",
    "",
    "8. CONVERSION. Home: the real starting price and 'free, 30 minutes, no obligation' next to one primary CTA. /services: one differentiating line per tier instead of the identical '24/7 Support - Fast Delivery - Premium Quality' strip, and at most one POPULAR per service. /pricing: state VAT, say what is not included, link each tier to its FAQ answer. Bundle builder: show list total, discount and total as it changes. Fix the copy defects 'Per per page', 'Per each', 'Per starting from' and the leaked tab labels.",
    "",
    "9. DO NOT invent a client, review, team member, address or metric; add a second design system, font or colour; add a chat widget that answers from nowhere; change already-indexed URLs without a redirect.",
    "",
    "10. ACCEPTANCE before you stop: each route returns a different title; /robots.txt, /sitemap.xml and /llms.txt return 200 and the sitemap lists all 13 service pages and every post; the same tier has the same price on /, /pricing and /services with a VAT statement; grepping the source for 'yourcompany', '[Your', '020 7946' and 'digital-solutions' returns nothing; the homepage shows real counts with JavaScript disabled; no page has two h1s and no h1 contains a product name; every published rating links to its profile; Rich Results Test is clean on /, one service page and one post.",
  ].join("\n"),
};

/** Anything's own ceiling is generous; this is the Studio's, so a paste mistake fails loudly here. */
export const BRIEF_MAX = 12_000;

export const briefLength = (brief: Brief = APEX_AUDIT_BRIEF): number => brief.prompt.length;
