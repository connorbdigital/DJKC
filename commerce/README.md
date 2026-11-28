# KC Commerce

A storefront framework built around the failures the market leaders still have — not around their features.

The research below is desk research done in November 2026, from published benchmarks and the studies they cite. Where a number comes from a vendor's own survey, it says so. Nothing here is a projection of what a shop "could" gain; the numbers are what the industry already measures, and the framework is simply the set of decisions that beat them.

```
commerce/
├── src/money.ts      integer minor units, VAT-inclusive prices, one formatter
├── src/catalog.ts    product/variant model + the completeness validator agents read
├── src/search.ts     typo-tolerant index that never dead-ends
├── src/cart.ts       deterministic pricing: discounts, delivery, stock truth
├── src/checkout.ts   guest-first flow as a spec, plus an audit that fails loudly
├── src/seo.ts        Product/Offer/ReturnPolicy JSON-LD, breadcrumbs, FAQ, llms.txt
├── src/budget.ts     performance and accessibility budgets that fail a build
├── src/csv.ts        supplier CSV in, CSV out: quotes, BOMs, ragged rows, odd headers
├── src/importProducts.ts  four supplier column maps, price/stock coercion, per-row issues
├── src/exportFeed.ts Google Merchant feed, products.json, sitemap
├── src/feedSource.ts feed URL checks, redaction, "what arrived in this file"
├── src/siteModel.ts  delivery promises, stock labels, key facts, related items, titles, FAQs
├── src/affiliate.ts  affiliate and marketplace rates as data: payout with caps, the route decision
└── src/fixtures.ts   two example products: one complete, one deliberately thin

catalogue/
├── site.ts               the brand, the delivery promises and twelve departments with aliases
├── render.ts             the CSS, the basket JavaScript and every page component
├── products.csv          32 demo products across eight departments, twelve spec columns
├── scripts/build-site.mts  the whole shop: pages, schema, feed, llms.txt, sitemap, robots
└── dist/                 generated: 45 HTML pages, 33 SVGs, feed, JSON, llms.txt

feeds/                    downloaded supplier files (git-ignored) + a redacted manifest
scripts/fetch-feed.mts    npm run feed — fetch, date, hash and describe a supplier feed
COMMISSION.md             margin, marketplace commission and affiliate rates, worked out
SUPPLIERS.md              where the CSVs come from, with links
GAPS.md                   what a real store has that this does not
FULFILMENT.md             a paid basket to a parcel: the state machine, the supplier contract, what to build
SEO-AEO.md                what the build already emits, and the five gaps that cost money
RESEARCH.md               five suppliers in depth, Stripe at catalogue scale, the BigBuy verdict
```

Pure TypeScript, no runtime dependencies, no React. `npm test` runs 119 tests; `npm run typecheck` is clean.

**What is still missing** is [`GAPS.md`](GAPS.md): every row compared against what Amazon, Argos, Wayfair and a default Shopify theme do — payments, order records, returns, reviews, facets, tax, analytics — with the five things to build next and four things not to build at all.

**Sourcing and the catalogue:** [`SUPPLIERS.md`](SUPPLIERS.md) lists the supplier feeds worth having (Aosom, BigBuy, Avasam, Matterhorn and the rest), what each sends you, and what it costs. `npm run site` builds a working store from any of those files (default: `catalogue/products.csv`):

```bash
cd commerce
npm run feed -- --url "<the URL from your supplier portal>" --name supplier
npm run site -- feeds/supplier-2026-11-20.csv
npm run serve:catalogue          # http://localhost:4300
```

`npm run feed` refuses plain HTTP and an account hidden in the URL, dates the file,
records a SHA-256 and a redacted URL in `feeds/manifest.json`, and tells you which
supplier profile it recognises. Credentials come from `FEED_AUTH_HEADER`,
`FEED_USER`/`FEED_PASS` or the environment — never from a committed file.

The demo images are generated placeholders; the products are invented. The importer, the feed exporter and the pages are not.

**What `npm run site` produces** — one command, no framework, no build server:

| Output | Why it exists |
| --- | --- |
| `index.html`, `shop.html`, `search.html` | A home page that answers before it sells, the full grid, and a client-side search that reads `products.json` |
| `department/<id>.html` × 12 | The full taxonomy — home, kitchen, garden, lighting, bedding, storage, pets, DIY, toys, electricals, beauty, office — including the four shelves that are honest about being empty |
| `product/<slug>.html` × 32 | Price, delivery cost before the click, stock from the file, key facts, delivery/returns/care accordions, related products |
| `pages/{delivery-returns,about,contact}.html` | The policies an affiliate network or a payments provider asks for, written to be read |
| `products.json`, `google-feed.csv` | The catalogue as data: for the search box, for Merchant Center, for anything else |
| `llms.txt`, `llms-full.txt` | The shop's facts in the shape answer engines ask for, with a canonical URL per line |
| `sitemap.xml`, `robots.txt` | `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot — being absent from an answer is a choice, not an accident |
| `assets/*.svg` × 33 | Deterministic placeholders, labelled as placeholders in the alt text |

Schema.org emitted: `OnlineStore`, `WebSite` with `SearchAction`, `ItemList`, `CollectionPage`, `Product` with `Offer`, `MerchantReturnPolicy`, `OfferShippingDetails` (the real £3.95, not a zero), `BreadcrumbList` and `FAQPage`.

**The money, in code:** [`src/affiliate.ts`](src/affiliate.ts) holds Amazon UK Associates, AliExpress Portals, eBay Partner Network, the Aosom/Awin programme and the marketplace seller fees as typed objects — rate by category, cookie length, per-sale cap, the gates that must be passed, and the catch. `payout()` applies the cap; `compareRoute()` puts the affiliate commission and the resale net on the same £49.99 sale; `routeFor()` makes the decision from basket size, markup and whether the traffic is yours. [`COMMISSION.md`](COMMISSION.md) renders the same numbers, including why Alibaba is not a commission route at all.

---

## 1. Who the leaders are

| Rank | Store | Monthly visits (Jul 2026) | What it is | How it wins |
| --- | --- | --- | --- | --- |
| 1 | Amazon | ~2.4B | Marketplace | Logistics and trust: Prime, returns, reviews, "buy now" |
| 2 | Temu | ~1.25B | Marketplace | Price and discovery feed; reach half of Amazon's traffic in four years |
| 3 | AliExpress | ~620M | Marketplace | Long-tail supply |
| 4 | Walmart | ~506M | Omnichannel retail | Pickup and delivery; the fastest-growing top-10 retailer |
| 5 | eBay | ~500M | Marketplace | Resale and auctions |
| 8 | Shein | ~320M | Fashion | Trend velocity |

Amazon holds roughly 38% of US online retail by revenue; the top ten take about 60% of a $1.2tn market. None of that is reachable by a new shop — and none of it is where a new shop should compete.

## 2. What they are still getting wrong

These are industry-wide measurements, which means they apply to the leaders too. A new shop that simply does not have these faults starts ahead of a bigger one that does.

| Failure | What the data says | Why it persists |
| --- | --- | --- |
| **Checkout friction** | Cart abandonment averages **70.2%** across 50 studies (Baymard, updated Sep 2025). Top preventable reasons: unexpected costs ~40–48%, forced account ~18–26%, checkout too long ~17–21%, distrust of card entry ~19%, missing preferred payment ~22%. Mobile abandonment ~80% against ~66% on desktop. | Checkouts grow features (gift message, loyalty, insurance) faster than they lose them. The average US checkout shows **23.5 form elements** where ~12 is achievable. |
| **Mobile speed** | Google/Deloitte: **every 0.1s** of load improvement lifts retail conversion ~**8%**. Shopify: each **100ms** of LCP improvement correlates with ~**3.5%** more conversions; 1.5s LCP stores convert ~30% higher than 2.5s LCP stores. Only ~**39%** of ecommerce sites pass all three Core Web Vitals. | Product images and third-party app embeds. Product images are the LCP element on ~78–84% of product pages. |
| **Search dead-ends** | Shoppers who search convert several times better, and **~80%** abandon after a poor search; **~70%** of on-site searches fail on synonyms or typos; only ~**34%** of sites offer useful autocomplete. | Search is treated as a text input, not a revenue surface. |
| **Invisible to AI shopping** | Only ~**11%** of Shopify stores have complete Product structured data; products with complete schema are several times more likely to be picked by agents. Required: name, offers.price, priceCurrency, canonical availability URL, brand, GTIN/MPN, return policy. | Themes emit partial markup; nobody validates it. |
| **Inaccessible checkout** | **94%** of audited European ecommerce journeys fail WCAG checks; **84%** of checkout pages mislabel fields so screen readers cannot name them. 4,605+ ADA digital lawsuits in the US in 2025 (+12% YoY), with retail the largest target. Overlays do not fix it. | Accessibility is tested last, if at all. |
| **Returns as a cliff edge** | Online returns ~**19.3%** of sales (2025); **77%** of shoppers who had a good return experience would buy again, **71–89%** of those with a bad one would not. UK merchants convert returns into exchanges at **5.8%** versus **17.1%** in the US — a portal-design gap, not a customer-preference one. | Returns are owned by operations, not by the product team. |

The honest summary: the leaders win on catalogue, price and logistics. They are beatable on **the last two metres** — the page, the search box, the checkout, the markup.

## 3. The framework

Five rules, each enforced by code rather than promised in a document.

### Rule 1 — Guest checkout, ≤12 form elements, total before payment

`checkout.ts` builds the flow and audits any configuration against it. `auditFlow()` fails on an account wall, a total that first appears at payment, more than 12 elements, no express wallet, manual address entry, or pre-ticked marketing consent (which is not valid consent under UK GDPR).

The default flow is 7 elements: email, name, address lookup, postcode, optional phone, card, terms. That is below the Baymard budget, not at it.

### Rule 2 — Money as integers, VAT inside the price

`money.ts` refuses decimals outright. `times(£19.99, 3)` is `5997`, never `59.970000000000006`. `vatIncluded()` splits the tax out of the shelf price because UK prices are quoted gross. `format()` is the only place the shopper sees a symbol; `toDecimalString()` is the only thing schema.org sees.

### Rule 3 — A catalogue that can be read by a machine

`catalog.ts` models what agents and Merchant Centre actually consume. `validateProduct()` returns a named issue **and the commercial reason** for each gap: missing GTIN/MPN (ambiguous product, demoted), thin description (cannot answer a conversational query), fake compare-at price (pricing-standards problem), returns under 14 days (unenforceable in the UK), a rating with no reviews (fabrication).

`seo.ts` turns a valid product into JSON-LD with `Offer`, canonical `https://schema.org/InStock`-style availability, `price` as a decimal **string**, `priceCurrency`, `AggregateRating` only when reviews exist, `OfferShippingDetails`, and `MerchantReturnPolicy`. It also generates breadcrumbs, `FAQPage`, and an `llms.txt` that states prices and policies plainly.

### Rule 4 — Search that cannot dead-end

`search.ts` is a small in-memory index: stop-word removal, prefix matching, one-edit tolerance (`hodie` finds `hoodie`), explicit synonyms (`jumper` → `Hoodies`), bestseller weighting only where a real match exists, and a fallback — nearest category, else best sellers — so a miss is a detour rather than a wall. It also returns the correction to show ("Showing results for…").

### Rule 5 — Budgets and accessibility checks that fail the build

`budget.ts` holds the numbers as data with the reason attached — LCP ≤2.0s, INP ≤200ms, CLS ≤0.05, ≤120kB JS, ≤200kB largest image, ≤40 requests, contrast ≥4.5:1, tap targets ≥24px — and reports unmeasured metrics as **unproven**, not as passing. `auditMarkup()` catches the failures that block a screen reader: unnamed buttons, unlabelled inputs, visual-only validation, missing alt text, sub-24px targets, each tagged with the WCAG criterion.

## 4. The scorecard

| Measure | Industry baseline | What this framework ships | Source of the baseline |
| --- | --- | --- | --- |
| Checkout form elements | 23.5 average | 7 | Baymard |
| Forced account creation | ~18–26% of abandoners cite it | impossible to configure without a failing audit | Baymard |
| Cart abandonment | 70.2% average | targeted at the preventable causes only — no claim that browsing abandoners convert | Baymard |
| LCP budget | 39% of sites pass CWV | 2.0s budget, 200kB image ceiling | Google/Deloitte, Shopify |
| Product schema completeness | ~11% of Shopify stores | validation blocks an incomplete product | AI-shopping audits |
| Search | ~70% fail on synonym/typo | typo-tolerant, synonym-aware, never empty | eConsultancy, Forrester summaries |
| WCAG 2.2 AA checkout | 94% of journeys fail | automated audit + markup rules | Contentsquare Foundation |
| Returns | 19.3% of online sales | policy in schema, exchange-first flow modelled | NRF/Happy Returns |

## 5. Using it

The modules are pure functions over plain data, so they drop into any stack:

```ts
import { buildIndex, search, priceCart, addToCart, emptyCart, productJsonLd, defaultCheckout, auditFlow } from "./src";

const index = buildIndex(products, [{ term: "jumper", means: ["Hoodies"] }]);
const results = search(index, "hodie", ["Hoodies", "Bags"]);   // never empty

const cart = addToCart(emptyCart(), "HOOD-CHR-S", 1);
const priced = priceCart(cart, { products, shipping, discounts, vatRate: 20 });
// → total includes delivery; taxIncluded is the VAT inside it; issues name stock problems

const ld = productJsonLd(product, variant, { url, siteName: "Northline" });
const flow = defaultCheckout();
if (auditFlow(flow).length) throw new Error("checkout regressed");
```

Render pages statically (or server-side) so the markup and the JSON-LD exist before JavaScript does; hydrate search and the basket afterwards. Run `checkBudgets()` and `auditMarkup()` in CI on every pull request.

## 6. What it deliberately does not do

- **No payment integration.** It prices an order and defines the checkout; Stripe or another PSP still collects the card. PCI scope stays where it belongs.
- **No hosting or rendering opinion.** Static-first is the recommendation, not a dependency.
- **No accounts, PIM or ERP sync.** A framework that pretends to be a platform becomes one badly.
- **No dark patterns.** Countdown timers, fake scarcity and pre-ticked consent are excluded by design, and consent is checked in code.
- **No claims it cannot keep.** The numbers in this README are other people's research, cited below.

## 7. Sources

- Baymard Institute, cart abandonment and checkout usability — https://baymard.com/lists/cart-abandonment-rate
- Google/Deloitte, "Milliseconds Make Millions" — https://www.deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html
- Shopify, Core Web Vitals and conversion — https://performance.shopify.com/
- Contentsquare Foundation, ecommerce accessibility snapshot — https://contentsquare.com/press/ecommerce-accessibility-snapshot/
- UsableNet, ADA digital accessibility lawsuits — https://blog.usablenet.com/
- NRF & Happy Returns, 2025 Retail Returns Landscape — https://nrf.com/research/2025-retail-returns-landscape
- Narvar, State of Post-Purchase 2025 — https://corp.narvar.com/
- Loop, 2025 State of Ecommerce Returns — https://www.loopreturns.com/
- schema.org Product / Offer / MerchantReturnPolicy — https://schema.org/Product
- Semrush traffic analytics, via top-100 ecommerce rankings (Jul 2026) — https://www.semrush.com/analytics/traffic/
- eConsultancy / Forrester site-search summaries — https://econsultancy.com/
