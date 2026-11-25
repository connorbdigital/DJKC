/**
 * The board: everything a website is expected to have, whether or not this repo
 * has it yet.
 *
 * Two sites are scored against every line — the shop (`commerce/`, Hearth &
 * Grain) and the band's site (sitebuildup.co.uk) — because a checklist with no
 * verdicts is a wish list. `where` says what is actually in the repository, or
 * why the line is empty, so the board can be checked against the code rather
 * than believed.
 *
 * `best` is what the line looks like done well: two examples, one from the UK
 * and one from elsewhere, because "best" is local as well as global.
 */

export type StandardArea = "trust" | "discovery" | "commerce" | "performance" | "data" | "brand" | "access";

export interface StandardExample {
  label: string;
  href: string;
  why: string;
}

export type StandardState = "yes" | "partial" | "no";

export interface Standard {
  id: string;
  area: StandardArea;
  title: string;
  /** What breaks when it is missing, in one sentence. */
  why: string;
  /** Hearth & Grain (the shop). */
  shop: StandardState;
  /** sitebuildup.co.uk (the band's site). */
  band: StandardState;
  /** What is in the repository, or what is missing and why. */
  where: string;
  best: StandardExample[];
}

export const AREA_LABEL: Record<StandardArea, string> = {
  trust: "Trust and legal",
  discovery: "Being found",
  commerce: "Selling",
  performance: "Speed and resilience",
  data: "Knowing what happens",
  brand: "Brand and voice",
  access: "Accessibility",
};

export const AREA_NOTE: Record<StandardArea, string> = {
  trust: "The pages a stranger checks before they trust you with a card or an email.",
  discovery: "How a search engine, an AI answer or a shared link finds and describes the page.",
  commerce: "Everything between wanting a thing and having it, including the boring bits.",
  performance: "What the page does on a bad connection and on a phone three years old.",
  data: "Consent, analytics and events — the difference between guessing and knowing.",
  brand: "Name, voice, images and the small pieces that make a link look like you.",
  access: "The parts that decide whether a person with a screen reader can buy anything.",
};

export const STATE_LABEL: Record<StandardState, string> = { yes: "in place", partial: "partly there", no: "missing" };

export const STANDARDS: Standard[] = [
  /* ------------------------------------------------------------- trust */
  {
    id: "privacy",
    area: "trust",
    title: "Privacy notice",
    why: "You cannot take an email address or set a cookie lawfully without one, and a missing notice is the first thing a cautious buyer checks.",
    shop: "no",
    band: "no",
    where: "Not generated. `catalogue/site.ts` has the contact details the notice would need; the page itself does not exist.",
    best: [
      { label: "GOV.UK — personal information charter", href: "https://www.gov.uk/government/organisations/government-digital-service/about/personal-information-charter", why: "Plain English, no lawyer fog, says what is held and why." },
      { label: "Stripe — privacy", href: "https://stripe.com/privacy", why: "A payments company explaining law it must obey, in sentences." },
    ],
  },
  {
    id: "terms",
    area: "trust",
    title: "Terms of sale and company details",
    why: "UK consumer law expects a trading name, a registered address and the terms of the sale to be reachable from every page.",
    shop: "no",
    band: "no",
    where: "Missing on both. The shop's footer names the brand and a phone number but no company number or address.",
    best: [
      { label: "John Lewis — terms", href: "https://www.johnlewis.com/customer-services/information/terms-and-conditions", why: "Long, but indexed so you can find the one clause you came for." },
      { label: "IKEA — terms and conditions", href: "https://www.ikea.com/gb/en/customer-service/terms-conditions/", why: "Sectioned by journey: buying, delivering, returning." },
    ],
  },
  {
    id: "returns",
    area: "trust",
    title: "Delivery and returns policy",
    why: "The single most-read page on a small shop, and the one a basket is abandoned over.",
    shop: "yes",
    band: "no",
    where: "`pages/delivery-returns.html`, generated from the delivery block in `commerce/catalogue/site.ts`.",
    best: [
      { label: "Argos — returns", href: "https://www.argos.co.uk/help/returns-and-refunds", why: "Answers the question in the first line, then the exceptions." },
      { label: "ASOS — returns", href: "https://www.asos.com/customer-care/returns-refunds/", why: "A printable label and a time limit at the top of the page." },
    ],
  },
  {
    id: "contact",
    area: "trust",
    title: "Contact route a human answers",
    why: "A contact page with a form and no address reads as a dropshipper's shell.",
    shop: "partial",
    band: "yes",
    where: "`pages/contact.html` for the shop, plus a phone number in the footer; the band's site has a real form and an address.",
    best: [
      { label: "Monzo — contact", href: "https://monzo.com/help", why: "Routes by what you need, with the waiting time stated." },
      { label: "Screwfix — contact", href: "https://www.screwfix.com/help/contact-us", why: "Phone hours, a callback and a store finder on one screen." },
    ],
  },
  {
    id: "cookies",
    area: "trust",
    title: "Cookie banner that means something",
    why: "PECR needs consent before non-essential cookies; a banner that only says \"we use cookies\" is worse than none.",
    shop: "no",
    band: "no",
    where: "Neither site sets analytics cookies, so neither needs a banner yet — and neither has one. Adding analytics without the banner would be the mistake.",
    best: [
      { label: "GOV.UK — cookies", href: "https://www.gov.uk/help/cookies", why: "Lists every cookie, says what it is for, and lets you change your mind." },
      { label: "BBC — cookies", href: "https://www.bbc.co.uk/usingthebbc/cookies/", why: "Categories, with the essential ones named." },
    ],
  },
  {
    id: "accessibility-statement",
    area: "trust",
    title: "Accessibility statement",
    why: "Legally expected of public bodies, and a trust signal for everyone else: it says what you tested and what you know is broken.",
    shop: "no",
    band: "no",
    where: "Missing. `sitecheck.ts` already checks headings and alt text on a live page, so the first draft could be written from its own output.",
    best: [
      { label: "GOV.UK — accessibility statement", href: "https://www.gov.uk/help/accessibility-statement", why: "The template most UK statements are copied from." },
      { label: "W3C — accessibility statement generator", href: "https://www.w3.org/WAI/planning/statements/generator/", why: "Asks the questions, writes the page." },
    ],
  },

  /* --------------------------------------------------------- discovery */
  {
    id: "sitemap",
    area: "discovery",
    title: "Sitemap and robots.txt",
    why: "Without them a new site waits weeks for a crawler to guess its shape.",
    shop: "yes",
    band: "partial",
    where: "`catalogue/dist/sitemap.xml` and `robots.txt` are generated by `npm run site`; the band's site is generated too but the sitemap is not submitted anywhere.",
    best: [
      { label: "Google — sitemaps", href: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview", why: "The rules small sites get wrong: canonical URLs, one sitemap, lastmod." },
      { label: "Shopify — sitemap", href: "https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map", why: "Automatic and correct, which is the bar for a generated shop." },
    ],
  },
  {
    id: "structured-data",
    area: "discovery",
    title: "Structured data",
    why: "Product, breadcrumb and FAQ markup is the difference between a plain blue link and a price, a rating and an answer.",
    shop: "yes",
    band: "no",
    where: "Product and breadcrumb JSON-LD are generated per product page (three blocks each). The band's site has none.",
    best: [
      { label: "Google — structured data gallery", href: "https://developers.google.com/search/docs/appearance/structured-data/search-gallery", why: "The types that actually change a result." },
      { label: "John Lewis — rich results", href: "https://www.johnlewis.com/", why: "Price and availability in the result, because the markup is right." },
    ],
  },
  {
    id: "sharing",
    area: "discovery",
    title: "Open Graph and Twitter cards",
    why: "A link with no image is a link nobody clicks, and every share is a free impression.",
    shop: "yes",
    band: "partial",
    where: "The shop emits `og:*` and `twitter:card` on every page with a per-page image; the band's site has a title and description only.",
    best: [
      { label: "The Open Graph protocol", href: "https://ogp.me/", why: "Short enough to read in full." },
      { label: "Linear — link previews", href: "https://linear.app/", why: "Every page shares as a card that looks designed for the share." },
    ],
  },
  {
    id: "canonical",
    area: "discovery",
    title: "Canonical URLs",
    why: "Filters, search pages and trailing slashes multiply one page into five and split its ranking.",
    shop: "yes",
    band: "no",
    where: "Every generated page carries `<link rel=\"canonical\">`. The band's pages rely on there being exactly one URL each.",
    best: [
      { label: "Google — canonicalisation", href: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls", why: "Says when a canonical is ignored, which is the useful half." },
      { label: "IKEA — canonical", href: "https://www.ikea.com/gb/en/", why: "Large catalogue, one canonical per product, filters kept out of the index." },
    ],
  },
  {
    id: "llms",
    area: "discovery",
    title: "A page an assistant can read",
    why: "More buying questions are answered by a model than by a search box; a clean text summary is how it quotes you correctly.",
    shop: "yes",
    band: "no",
    where: "`llms.txt` and `llms-full.txt` are generated with the catalogue. Nothing equivalent exists for the band's site.",
    best: [
      { label: "llmstxt.org", href: "https://llmstxt.org/", why: "The convention itself, with examples." },
      { label: "Stripe — docs for machines", href: "https://docs.stripe.com/", why: "Every page readable without JavaScript, which is the real requirement." },
    ],
  },
  {
    id: "search",
    area: "discovery",
    title: "Search that survives its own results",
    why: "Site search is where a shop with 32 products and a shop with 3,000 are told apart.",
    shop: "partial",
    band: "no",
    where: "`search.html` reads `search-index.json` client side, with no synonyms, no typo tolerance and no empty-results advice.",
    best: [
      { label: "Algolia — search UX guide", href: "https://www.algolia.com/doc/guides/building-search-ui/going-further/improve-search-results/", why: "Synonym and typo handling explained for people who ship." },
      { label: "Screwfix — search", href: "https://www.screwfix.com/", why: "Part numbers, trade names and slang all land in the same place." },
    ],
  },

  /* ---------------------------------------------------------- commerce */
  {
    id: "basket",
    area: "commerce",
    title: "A basket that survives a refresh",
    why: "A basket that empties on reload loses the sale quietly, and nobody reports it.",
    shop: "yes",
    band: "no",
    where: "The basket is stored in `localStorage` under `hearth-grain-basket` and re-read on load; it survives a refresh and a closed tab.",
    best: [
      { label: "Shopify — cart persistence", href: "https://shopify.dev/docs/storefronts/themes/architecture/templates/cart", why: "The default behaviour every shopper assumes." },
      { label: "Argos — trolley", href: "https://www.argos.co.uk/", why: "Trolley, stock and delivery estimate kept together." },
    ],
  },
  {
    id: "checkout",
    area: "commerce",
    title: "A checkout that takes money",
    why: "Everything else is a brochure. The shop has no payment step yet, so it cannot sell anything.",
    shop: "no",
    band: "no",
    where: "Missing. `COMMISSION.md` works out the margins; there is no Stripe (or any) payment integration in `commerce/`.",
    best: [
      { label: "Stripe — checkout", href: "https://docs.stripe.com/payments/checkout", why: "Hosted page, tax and wallets handled, one redirect." },
      { label: "Shopify — one-page checkout", href: "https://www.shopify.com/checkout", why: "The conversion benchmark small shops are measured against." },
    ],
  },
  {
    id: "shipping-rules",
    area: "commerce",
    title: "Shipping rules that match the promise",
    why: "Free over £40 is a rule, not a sentence: it has to be applied in the basket, not just advertised.",
    shop: "partial",
    band: "no",
    where: "The delivery block holds the threshold and the price, and the utility bar repeats them; the basket does not add the shipping line yet.",
    best: [
      { label: "Royal Mail — pricing", href: "https://www.royalmail.com/sending/uk", why: "What the actual cost is, before you promise free." },
      { label: "ASOS — delivery", href: "https://www.asos.com/customer-care/delivery/", why: "Options, prices and cut-off times in one table." },
    ],
  },
  {
    id: "stock",
    area: "commerce",
    title: "Stock that is true",
    why: "Selling something you do not have costs a refund and a review; the feed is only as good as its sync.",
    shop: "partial",
    band: "no",
    where: "Stock is a column in `products.csv` and is checked at build time (0 issues); nothing syncs it from a supplier yet.",
    best: [
      { label: "BigBuy — stock sync", href: "https://www.bigbuy.eu/en/", why: "The feed that makes a one-person shop's stock real." },
      { label: "Screwfix — live stock", href: "https://www.screwfix.com/", why: "Per-store counts, which is the strongest version of the promise." },
    ],
  },
  {
    id: "order-email",
    area: "commerce",
    title: "Order confirmation and dispatch email",
    why: "The email is the only proof of purchase a customer keeps, and the first place they look when something goes wrong.",
    shop: "no",
    band: "no",
    where: "Missing, and blocked on checkout: there is no order to confirm yet.",
    best: [
      { label: "GOV.UK Notify", href: "https://www.notifications.service.gov.uk/", why: "Cheap, reliable transactional email with a plain template engine." },
      { label: "Monzo — receipts", href: "https://monzo.com/", why: "The standard for a confirmation that looks like the brand." },
    ],
  },

  /* ------------------------------------------------------ performance */
  {
    id: "static",
    area: "performance",
    title: "Pages that are files, not a runtime",
    why: "A static page cannot have a bad day at the database, and it is the cheapest thing to host.",
    shop: "yes",
    band: "yes",
    where: "The shop is 45 generated HTML files; the band's site is generated the same way. Both are served from a CDN.",
    best: [
      { label: "web.dev — static rendering", href: "https://web.dev/articles/rendering-on-the-web", why: "The trade-offs, from the people who measure them." },
      { label: "GOV.UK — how it is built", href: "https://www.gov.uk/guidance/how-govuk-is-built", why: "Static-first at national scale." },
    ],
  },
  {
    id: "images",
    area: "performance",
    title: "Images sized, compressed and lazy",
    why: "Images are most of the bytes on a shop page, and the usual reason a phone takes four seconds to show a price.",
    shop: "partial",
    band: "partial",
    where: "The shop uses SVG placeholders (tiny, but not photographs); real product photography will need widths, `loading=\"lazy\"` and modern formats.",
    best: [
      { label: "web.dev — image optimisation", href: "https://web.dev/learn/images", why: "Formats, sizes and the `<picture>` element, end to end." },
      { label: "Tesco — product imagery", href: "https://www.tesco.com/", why: "Hundreds of images a page, still fast, because every one is sized." },
    ],
  },
  {
    id: "core-web-vitals",
    area: "performance",
    title: "Core Web Vitals measured, not assumed",
    why: "LCP, CLS and INP are what Google ranks on and what a customer feels; both are invisible without a measurement.",
    shop: "no",
    band: "no",
    where: "No field data collected. `sitecheck.ts` can fetch a page and report headings and alt text, but nothing measures layout shift or paint.",
    best: [
      { label: "PageSpeed Insights", href: "https://pagespeed.web.dev/", why: "Field and lab numbers for any URL, free." },
      { label: "web.dev — Core Web Vitals", href: "https://web.dev/articles/vitals", why: "What each metric means and what counts as good." },
    ],
  },
  {
    id: "canonical-404",
    area: "performance",
    title: "A 404 that helps",
    why: "Broken links arrive from everywhere; a dead end loses the visit and the crawl budget.",
    shop: "no",
    band: "no",
    where: "Neither site has a custom 404: the host serves its own page.",
    best: [
      { label: "GOV.UK — page not found", href: "https://www.gov.uk/does-not-exist", why: "Search, popular pages and a plain apology." },
      { label: "GitHub — 404", href: "https://github.com/this-page-does-not-exist-xyz", why: "Minimal, and gets you back to a working page in one click." },
    ],
  },

  /* ------------------------------------------------------------- data */
  {
    id: "analytics",
    area: "data",
    title: "Analytics with consent",
    why: "Without numbers every decision is a guess; without consent the numbers are a liability.",
    shop: "no",
    band: "no",
    where: "No analytics on either site. Nothing is measured, and nothing is set that would need a banner.",
    best: [
      { label: "Plausible", href: "https://plausible.io/", why: "Cookieless, one script, no banner needed in most configurations." },
      { label: "GOV.UK — performance platform legacy", href: "https://www.gov.uk/service-manual/measuring-success", why: "What to measure before measuring anything." },
    ],
  },
  {
    id: "events",
    area: "data",
    title: "The four events worth naming",
    why: "Pageviews say where people went; add-to-basket, search-with-no-results, checkout start and checkout finish say why.",
    shop: "no",
    band: "no",
    where: "None. The basket has the state to emit them — there is no dispatcher.",
    best: [
      { label: "GA4 — recommended events", href: "https://support.google.com/analytics/answer/9267735", why: "The naming other tools already understand." },
      { label: "Shopify — analytics", href: "https://shopify.dev/docs/api/web-pixels-api", why: "Events from a shop that has to work for thousands of them." },
    ],
  },

  /* ------------------------------------------------------------ brand */
  {
    id: "name",
    area: "brand",
    title: "A name that is a name",
    why: "\"Ecommerce\" was a category, and a category cannot be remembered, searched for or trusted.",
    shop: "yes",
    band: "yes",
    where: "Renamed to Hearth & Grain (`commerce/catalogue/site.ts`), with HG- product codes; the band's name is its own.",
    best: [
      { label: "Monzo — naming", href: "https://monzo.com/", why: "Short, sayable, no explanation needed." },
      { label: "IKEA — naming system", href: "https://www.ikea.com/", why: "A rule for names, followed for decades." },
    ],
  },
  {
    id: "voice",
    area: "brand",
    title: "One voice, written down",
    why: "Two people writing product copy sound like two shops; a short voice note stops that.",
    shop: "yes",
    band: "partial",
    where: "The shop's copy has a rule (short sentences, the awkward question answered, no superlatives) and the brand block states it.",
    best: [
      { label: "GOV.UK — style guide", href: "https://www.gov.uk/guidance/style-guide", why: "The best short voice guide in the UK, and it is public." },
      { label: "Mailchimp — voice and tone", href: "https://styleguide.mailchimp.com/voice-and-tone/", why: "Tone by situation, with examples of each." },
    ],
  },
  {
    id: "manifest",
    area: "brand",
    title: "Favicon, app icon and manifest",
    why: "A tab with a default globe, or an \"add to home screen\" that adds a screenshot, is a brand saying nothing.",
    shop: "partial",
    band: "partial",
    where: "Both sites have a favicon; the Studio is installable as a PWA, the shop is not.",
    best: [
      { label: "web.dev — installability", href: "https://web.dev/articles/install-criteria", why: "What a manifest needs to be installable at all." },
      { label: "Linear — installable", href: "https://linear.app/", why: "Install prompt, icon and offline shell that all match." },
    ],
  },

  /* ----------------------------------------------------------- access */
  {
    id: "alt-text",
    area: "access",
    title: "Alt text on every image",
    why: "A shop where the pictures are the product is unusable with a screen reader if the pictures are unlabelled.",
    shop: "yes",
    band: "yes",
    where: "Generated alt text on every placeholder; `sitecheck.ts` reports images missing it.",
    best: [
      { label: "W3C — alt text decision tree", href: "https://www.w3.org/WAI/tutorials/images/decision-tree/", why: "Answers \"what do I write\" for each kind of image." },
      { label: "Tesco — accessible product images", href: "https://www.tesco.com/", why: "Product name, size and type in the alt, not \"product image\"." },
    ],
  },
  {
    id: "focus",
    area: "access",
    title: "Keyboard and focus that can be seen",
    why: "Everything clickable has to be reachable with a keyboard, with a focus ring that survives the CSS reset.",
    shop: "partial",
    band: "partial",
    where: "Links and buttons are real elements, but the shop has no skip link and its focus ring is the browser's grey default on a pale page.",
    best: [
      { label: "GOV.UK Design System — focus states", href: "https://design-system.service.gov.uk/components/", why: "The yellow-and-black focus state that made focus states matter." },
      { label: "W3C — keyboard access", href: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html", why: "The requirement, in the fewest words." },
    ],
  },
  {
    id: "contrast",
    area: "access",
    title: "Contrast you can pass",
    why: "Grey-on-white captions are the most common failure in a well-intentioned design, and the cheapest to fix.",
    shop: "partial",
    band: "partial",
    where: "Body text passes; the muted captions in both designs sit around 4:1 at small sizes, which is under the AA line.",
    best: [
      { label: "WebAIM — contrast checker", href: "https://webaim.org/resources/contrastchecker/", why: "Paste two colours, get a verdict." },
      { label: "Stripe — accessible colour", href: "https://docs.stripe.com/", why: "Dense documentation that still passes AA." },
    ],
  },
  {
    id: "forms",
    area: "access",
    title: "Forms with labels, errors and no traps",
    why: "An unlabelled field or an error in red only is a form half the people cannot complete.",
    shop: "partial",
    band: "yes",
    where: "The band's enquiry form labels every field and states errors in text. The shop's contact form labels fields but says nothing to a screen reader when a field fails.",
    best: [
      { label: "GOV.UK — error messages", href: "https://design-system.service.gov.uk/components/error-message/", why: "Error summary, linked to the field, in text." },
      { label: "Stripe — form accessibility", href: "https://stripe.com/docs", why: "Card fields that work with a keyboard and a reader." },
    ],
  },
];

/** How many of the board's lines a site can claim. */
export function tally(which: "shop" | "band", standards: Standard[] = STANDARDS) {
  const total = standards.length;
  const yes = standards.filter((entry) => entry[which] === "yes").length;
  const partial = standards.filter((entry) => entry[which] === "partial").length;
  const no = total - yes - partial;
  return { total, yes, partial, no, score: Math.round(((yes + partial * 0.5) / total) * 100) };
}

/** The lines a site cannot do without, worst first: what to build next. */
export function gaps(which: "shop" | "band", standards: Standard[] = STANDARDS): Standard[] {
  const weight: Record<StandardState, number> = { no: 0, partial: 1, yes: 2 };
  return standards
    .filter((entry) => entry[which] !== "yes")
    .sort((a, b) => weight[a[which]] - weight[b[which]] || a.area.localeCompare(b.area));
}

export function byArea(standards: Standard[] = STANDARDS): { area: StandardArea; entries: Standard[] }[] {
  const areas: StandardArea[] = ["trust", "commerce", "discovery", "performance", "access", "data", "brand"];
  return areas.map((area) => ({ area, entries: standards.filter((entry) => entry.area === area) }));
}
