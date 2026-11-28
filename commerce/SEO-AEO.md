# Being found: what the shop already does, and the five things it does not

Search engines and answer engines read the shop differently from the artist site
(that one has its own record in `docs/seo-aeo-geo-2026-11-20.md`). The shop is a
product catalogue, so what matters is different: a machine has to be able to
parse a price, an availability, a delivery window and a return policy, and it has
to be willing to *trust* the shop enough to quote it.

Most of that is already built. This file exists so the remaining gaps are not
guessed at.

## What the build already emits

| Thing | Where | Why it matters |
| --- | --- | --- |
| `Product` + `Offer` JSON-LD, with price, currency, availability, condition, seller | `src/seo.ts` → every product page | what a shopping agent reads first |
| `OfferShippingDetails` — rate, handling time, transit time, GB only | same | an agent can answer "how much and how long" without asking |
| `hasMerchantReturnPolicy` — 14 days, return by mail, free or paid, stated | same | Google requires it for return-policy annotations |
| `gtin13` / `mpn` passed through *when the supplier supplied them* | same | identifiers are what stop a product being a stranger |
| `BreadcrumbList`, `CollectionPage` + `ItemList`, `FAQPage`, `WebSite` + `SearchAction`, `OnlineStore` | `src/seo.ts` / `build-site.mts` | hierarchy, category pages, and question markup |
| Canonicals, `og:*` and `twitter:card` on every page | `catalogue/render.ts:433–444` | link previews, and a canonical URL in every share |
| `robots.txt` that welcomes GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot | `build-site.mts:1225` | most AI crawlers do not run JavaScript, so this and the static HTML are the whole AEO story |
| `llms.txt` + `llms-full.txt` | `build-site.mts:1138`, `:1213` | a quotable summary of the catalogue in one fetch |
| `sitemap.xml` with `lastmod`, and out-of-stock products set to `noindex` | `build-site.mts:1216`, `:433` | nothing empty gets indexed |
| Google Merchant feed with per-row rejection reasons | `src/exportFeed.ts` | the feed is honest about what it could not export |

That is more than most small shops have. The gaps are not markup.

## The five that are actually costing money

### 1. Every image is an SVG — and Merchant Center will not take them

`catalogue/dist/assets/*.svg` is what the pages, the feed and the social tags all
point at. Google Merchant Center accepts JPEG, PNG, WebP and GIF; **SVG is not on
the list**, so all 32 rows in `google-feed.csv` are rejectable for their
`image_link` alone. The same SVG is `og:image` (`render.ts:440`), so X, LinkedIn,
Facebook and WhatsApp show no picture when a product is shared — and every AI
shopping surface that displays a product image shows nothing.

This is the cheapest fix with the largest effect: raster 1200×1200 (square, white
or lifestyle background) per product, plus a per-product `og:image` rather than
one site-wide image. Nothing else in the pipeline changes; `images` is already an
array of URLs.

### 2. No identifiers, and no declaration that there are none

Every row in the feed has an empty `gtin`. For a made-up own-brand that is
allowed — Merchant Center accepts `identifier_exists: no` — but the feed does not
send that column, so the rows are either rejected or warned on. Either supply the
supplier's real GTIN/EAN (most wholesale feeds have one), or declare the truth.
Do not invent a barcode: a wrong GTIN attaches the listing to somebody else's
product and the mismatch is what gets an account suspended.

### 3. The descriptions are the supplier's, so they are everybody else's

`product.description` is imported verbatim. Every other shop reselling that SKU
publishes the same paragraph, which is the definition of duplicate content, and it
also reads like a spec sheet rather than a reason to buy. The fix is editorial,
not technical: 80–120 words of our own per product, opening with a 40–60 word
answer-shaped sentence ("A three-tier bamboo shelf that folds flat, holds 15kg per
shelf and fits a rented kitchen's worth of pans — £49.99, delivered in 1–3 days"),
then the measurement, the material, who it is wrong for, and care. The `Key facts`
table stays as the machine-readable half.

This is also the E-E-A-T problem in one line: an invented brand with supplier copy
and placeholder photographs has no experience behind it, and both Google and the
answer engines now weight that. Real photos of the actual product, in an actual
room, plus a named person and a returns address, do more than any further schema.

### 4. No reviews — so no stars, anywhere

`aggregateRating` is implemented and unused: no product has `rating.count > 0`.
Star annotations in results and the "rated 4.6 by 38 people" line that AI answers
quote both need real reviews collected after delivery (an email three days after
`delivered`). Faking them is the one shortcut that reliably ends a Merchant
Center account.

### 5. Nothing to rank for except the product pages

The catalogue covers buying intent. There is no page for the question asked
*before* buying, which is where most of the traffic and nearly all of the
AI-answer citations are:

- "how do I store firewood indoors without mess" → the basket and the kindling holder
- "what actually fits on a rented kitchen shelf" → the folding rack
- "best housewarming gift under £50" → a curated collection page

Five of these, each with a real answer in the first paragraph, a comparison table,
`FAQPage` markup (the helper exists), and links to the products, would do more for
discovery than any tag added to a product page. And they are the pages an AI
assistant can cite, because a product page has nothing to say about a question.

## AEO, specifically for a shop

An answer engine asked "where can I buy a folding bamboo shelf rack in the UK"
wants, in this order: a name, a price, availability, a delivery window, a return
promise, and a reason to trust the seller. All six are on the page and all six are
in the JSON-LD — which is why the product pages are in better shape than most.

What is missing for that use:

- **One sentence per product that answers the question, above the fold.** The
  description starts with the supplier's spec; an agent quotes what it finds first.
- **A `dateModified` that changes when the price or the copy does.** The pages
  carry `updated` already; keep it honest as the catalogue churns.
- **Comparison tables.** "X vs Y" is the shape of most AI shopping answers; a
  table is what gets lifted.
- **The limits, said out loud.** "This rack is not for books — 15kg per shelf is
  the whole story" is what makes the rest of the page quotable.

## Measurement, which does not exist yet

Nothing here can claim an improvement without a baseline. Once the shop is live:
verify the domain in Search Console (the sitemap is ready), submit the Merchant
feed and read the rejection reasons, and run the same ten buyer questions across
Google, ChatGPT and Perplexity once a month, recording whether the shop is cited.
That list is the only honest scoreboard.

## Order of work

1. **Raster images + per-product `og:image`.** Unblocks the feed, the previews and
   the visual surfaces. *(Highest value per hour, no dependency.)*
2. **`identifier_exists` told truthfully, or real GTINs imported.**
3. **Own copy on the top 10 products** — the ones with the most stock and the best
   margin, not all 32.
4. **Five answer pages**, each with `FAQPage` markup and links to the products.
5. **Reviews after delivery**, once there are deliveries.
6. Merchant Center + Search Console, then measure.

Nothing in this list needs a supplier, an API key or a paid plan.
