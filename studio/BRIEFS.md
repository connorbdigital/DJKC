# Blog plan for sitebuildup.co.uk

14 posts, each written from a number this repository can prove. Generated from `studio/src/atlasBriefs.ts` — edit there, not here.

| Post | Query | Service | Status | Words |
| --- | --- | --- | --- | --- |
| [Your checkout is losing 7 in 10 baskets — and it is fixable in a week](#checkout-losing-money) | `why do customers abandon checkout uk` | e-commerce | outline | 1600 |
| [Show the delivery price before the pay button, or watch them leave](#delivery-cost-before-payment) | `show delivery cost before checkout conversion` | e-commerce | outline | 1200 |
| [100 milliseconds of load time is worth 3.5% of your revenue](#speed-100ms) | `site speed conversion rate 100ms` | website-design | outline | 1400 |
| [Your search box is a revenue surface, and 70% of queries fail on it](#search-box-revenue) | `on-site search synonyms conversion` | e-commerce | outline | 1300 |
| [Getting quoted by ChatGPT and Perplexity: what actually decides it](#get-quoted-by-ai) | `how to get my website cited by chatgpt` | seo-marketing | outline | 1800 |
| [The product schema that earns the click — and the one that gets you demoted](#schema-that-earns-clicks) | `product structured data schema mistakes` | seo-marketing | outline | 1500 |
| [£3.99 or £3.71: the 28p that decides whether you hold stock](#affiliate-vs-resell) | `affiliate vs dropshipping uk profit` | e-commerce | outline | 1700 |
| [Twelve departments, not a 'shop' page: how to structure a catalogue people can navigate](#twelve-departments) | `ecommerce category structure best practice` | website-design | outline | 1300 |
| [Returns are a marketing channel, and most UK shops treat them as a cost](#returns-are-marketing) | `returns policy conversion rate` | e-commerce | outline | 1200 |
| [Why every change we make opens a pull request first](#why-we-open-a-pr) | `website change management process agency` | business-automation | outline | 1400 |
| [Buy the boring parts: four things no small business should build itself](#buy-dont-build) | `custom website vs off the shelf small business` | website-design | outline | 1300 |
| [What a fixed-price website should include (and what 'from £795' must not hide)](#fixed-price-website) | `fixed price website design uk what included` | website-design | outline | 1500 |
| [llms.txt in practice: what we shipped, and what it changed](#llms-txt-worth-it) | `llms.txt example` | ai-automation | outline | 900 |
| [What 287 tests look like to a client who cannot read code](#testing-as-sales-proof) | `how do i know my website was built properly` | business-automation | outline | 1100 |

<a id="checkout-losing-money"></a>

## Your checkout is losing 7 in 10 baskets — and it is fixable in a week

**Promise.** Most abandoned baskets are abandoned for reasons the shop controls: cost revealed late, an account wall, and a form twice as long as it needs to be.

- Query: `why do customers abandon checkout uk`
- Audience: Shop owners turning over £100k–£2m who built once and have not audited since
- Service page: /services/e-commerce
- Length: ~1600 words

**Outline**

1. The 70.2% number, and what it does and does not mean
1. The four preventable reasons, with the percentages
1. What 23.5 form elements looks like on a phone
1. The 7-element checkout we ship instead — field by field
1. The one-week fix list, in order of return
1. What we will not do: countdown timers, pre-ticked consent, forced accounts

**Evidence**

- Cart abandonment averages 70.2% across 50 studies — *Baymard, updated Sep 2025*
- Unexpected costs cause 40–48% of preventable abandonments — *Baymard Institute cart-abandonment research — third-party, not measured here*
- Forced account creation accounts for 18–26% — *Baymard Institute checkout-usability research — third-party, not measured here*
- The average US checkout shows 23.5 form elements; ~12 is achievable — *Baymard Institute checkout-usability research — third-party, not measured here*
- Mobile abandonment is ~80% against ~66% on desktop — *Baymard Institute cart-abandonment statistics — third-party, not measured here*

**Proof in the repo:** `commerce/src/checkout.ts`, `commerce/src/cart.ts`, `commerce/GAPS.md`

---

<a id="delivery-cost-before-payment"></a>

## Show the delivery price before the pay button, or watch them leave

**Promise.** Delivery is the cheapest conversion lever in a shop: it costs nothing to state, and it removes the largest single cause of abandonment.

- Query: `show delivery cost before checkout conversion`
- Audience: Shop owners and marketers who think of delivery as an ops decision
- Service page: /services/e-commerce
- Length: ~1200 words

**Outline**

1. Why the last step is where trust breaks
1. What 'costs shown before payment' means on a product page
1. The card line: '+ £3.95 delivery' or 'Free delivery', never a surprise
1. Free-delivery thresholds: the nudge that pays for itself
1. How we build it so the price cannot drift from the policy

**Evidence**

- Unexpected costs are the top preventable abandonment reason at 40–48% — *Baymard Institute cart-abandonment research — third-party, not measured here*
- A stated £3.95 with free over £40 removes the surprise without giving margin away — *commerce/catalogue/site.ts, the demo shop's policy*
- The basket shows "£15.50 more for free delivery", not a countdown — *commerce/catalogue/render.ts*

**Proof in the repo:** `commerce/src/siteModel.ts`, `commerce/catalogue/render.ts`, `commerce/src/seo.ts`

---

<a id="speed-100ms"></a>

## 100 milliseconds of load time is worth 3.5% of your revenue

**Promise.** Speed is not a developer vanity metric; it is a conversion rate, and the work is mostly images and third-party scripts.

- Query: `site speed conversion rate 100ms`
- Audience: Owners who paid for a fast-looking site and never measured it
- Service page: /services/website-design
- Length: ~1400 words

**Outline**

1. The two studies that decide this argument
1. Why product images are the problem: the LCP element on 78–84% of pages
1. What 39% of sites passing Core Web Vitals actually means
1. The 2.0s / 200kB budget, and how a build can enforce it
1. A before-and-after measurement you can run in an hour

**Evidence**

- Every 0.1s of load improvement lifts retail conversion ~8% — *Google/Deloitte*
- Each 100ms of LCP improvement correlates with ~3.5% more conversions — *Industry speed benchmarks widely cited in 2023–25; third-party, not measured here*
- Stores at 1.5s LCP convert ~30% higher than those at 2.5s — *Industry speed benchmarks widely cited in 2023–25; third-party, not measured here*
- Only ~39% of ecommerce sites pass all three Core Web Vitals — *industry audits, 2026*

**Proof in the repo:** `commerce/src/budget.ts`, `commerce/src/seo.ts`

---

<a id="search-box-revenue"></a>

## Your search box is a revenue surface, and 70% of queries fail on it

**Promise.** Shoppers who search buy more; when the search box fails on a synonym, they leave rather than browse.

- Query: `on-site search synonyms conversion`
- Audience: Shop and catalogue owners with more than 50 products
- Service page: /services/e-commerce
- Length: ~1300 words

**Outline**

1. Search users convert several times better — and abandon at ~80% after a miss
1. Why 'shelves' does not find 'shelf' in most shops
1. Three fixes: synonyms, one-edit tolerance, a fallback that is not a dead end
1. The zero-result list you are not keeping
1. How the demo shop matches 'plantr' to planters

**Evidence**

- ~70% of on-site searches fail on synonyms or typos — *industry search studies*
- ~80% of shoppers abandon after a poor search result — *industry search studies*
- Only ~34% of sites offer useful autocomplete — *industry audits*
- Typo tolerance is one edit-distance check — about 40 lines, not a platform migration — *commerce/src/search.ts*

**Proof in the repo:** `commerce/src/search.ts`, `commerce/catalogue/site.ts`

---

<a id="get-quoted-by-ai"></a>

## Getting quoted by ChatGPT and Perplexity: what actually decides it

**Promise.** AI answers cite pages with complete, machine-readable facts; most shops publish almost none, which is why they are not in the answer.

- Query: `how to get my website cited by chatgpt`
- Audience: UK SMBs who have noticed their traffic shifting to AI answers
- Service page: /services/seo-marketing
- Length: ~1800 words

**Outline**

1. How an answer engine decides what to quote
1. Only ~11% of Shopify stores have complete Product structured data
1. The six fields an agent needs, and what happens when one is missing
1. robots.txt as a decision: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot
1. llms.txt: what it is, what it is not, and why we still ship it
1. A 30-minute audit you can run on your own site

**Evidence**

- Only ~11% of Shopify stores carry complete Product structured data — *industry audits, 2026*
- A generated catalogue can emit Product, Offer, ReturnPolicy and FAQPage on 50 pages in 0.6 seconds — *commerce/catalogue/scripts/build-site.mts*
- 7 fields decide it: name, offers.price, priceCurrency, availability, brand, GTIN/MPN and return policy — *commerce/src/catalog.ts validator*
- robots.txt names 6 crawlers explicitly: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot — *commerce/catalogue/scripts/build-site.mts*

**Proof in the repo:** `commerce/src/seo.ts`, `commerce/catalogue/scripts/build-site.mts`, `commerce/src/siteModel.ts`

---

<a id="schema-that-earns-clicks"></a>

## The product schema that earns the click — and the one that gets you demoted

**Promise.** Structured data is a contract: faked ratings and invented compare-at prices are the fastest way to lose the placement you wanted.

- Query: `product structured data schema mistakes`
- Audience: Marketers who have been told to 'add schema' without knowing which
- Service page: /services/seo-marketing
- Length: ~1500 words

**Outline**

1. What Google and shopping agents actually read
1. The five fields that carry the placement
1. Fabricated reviews: why AggregateRating without reviews is a liability
1. Compare-at prices that were never charged
1. How we validate before publishing

**Evidence**

- 2 schema rules people get wrong: price as a decimal string ('49.99'), availability as a full schema.org URL — *commerce/src/seo.ts*
- 0 reviews means 0 AggregateRating — a rating without reviews is fabrication — *commerce/src/catalog.ts validator*
- 14 days is the legal floor for UK distance selling; 30 is the policy the demo shop ships — *commerce/src/catalog.ts*

**Proof in the repo:** `commerce/src/seo.ts`, `commerce/src/catalog.ts`, `commerce/src/seo.test.ts`

---

<a id="affiliate-vs-resell"></a>

## £3.99 or £3.71: the 28p that decides whether you hold stock

**Promise.** On a £49.99 product, referring the sale pays more than reselling it — with none of the stock, carriage or returns risk.

- Query: `affiliate vs dropshipping uk profit`
- Audience: Anyone deciding between an affiliate site and a stock-holding shop
- Service page: /services/e-commerce
- Length: ~1700 words

**Outline**

1. The three routes, named properly
1. The £49.99 sale, line by line, both ways
1. Why VAT is divided, not subtracted
1. Where the caps bite: AliExpress at £900, eBay at £3,000
1. The decision rule: basket size, markup multiple, whose traffic it is
1. Alibaba is not a commission route, and that matters

**Evidence**

- Affiliate at 8% on a 30-day cookie pays £3.99 on £49.99 — *Aosom UK via Awin*
- Reselling at a plausible trade price nets £3.71 after VAT, carriage, fees and returns — *commerce/COMMISSION.md, worked line by line*
- AliExpress caps commission at US$50 per sale — *AliExpress Portals terms*
- eBay caps 1–4% at US$100–550 per transaction, 24-hour cookie — *eBay Partner Network terms*
- Amazon's API needs 3 qualifying sales in 180 days — *Amazon Associates*

**Proof in the repo:** `commerce/src/affiliate.ts`, `commerce/COMMISSION.md`

---

<a id="twelve-departments"></a>

## Twelve departments, not a 'shop' page: how to structure a catalogue people can navigate

**Promise.** Navigation is merchandising. A flat grid of products loses the shopper who does not yet know what the product is called.

- Query: `ecommerce category structure best practice`
- Audience: Shops with 30–500 products and one long 'Shop' page
- Service page: /services/website-design
- Length: ~1300 words

**Outline**

1. Why departments beat filters for browsing
1. The twelve-department model, with sections
1. Honesty about empty shelves, and why that earns trust
1. Aliases: mapping a supplier's category words onto yours
1. Pagination, priority and the sitemap

**Evidence**

- Twelve departments with sections cover 32 products without a dead end — *commerce/catalogue/site.ts*
- 30+ supplier category aliases map onto the 12 departments, so nothing lands in an "other" bucket — *commerce/src/siteModel.ts*
- 4 empty departments ship as real pages with noindex,follow — the tile still works, the sitemap stays clean — *commerce/catalogue/scripts/build-site.mts*

**Proof in the repo:** `commerce/catalogue/site.ts`, `commerce/src/siteModel.ts`, `commerce/catalogue/scripts/build-site.mts`

---

<a id="returns-are-marketing"></a>

## Returns are a marketing channel, and most UK shops treat them as a cost

**Promise.** A shopper who returns something easily buys again; a shopper who fights you tells everyone. The portal is cheaper than the review.

- Query: `returns policy conversion rate`
- Audience: Shop owners whose returns process is an inbox
- Service page: /services/e-commerce
- Length: ~1200 words

**Outline**

1. 19.3% of online sales come back
1. 77% of good-return shoppers buy again; 71–89% of bad ones do not
1. UK exchange conversion 5.8% vs 17.1% in the US — a design gap
1. The 30-day policy that fits inside the law and above it
1. What to put on the product page

**Evidence**

- Online returns are ~19.3% of sales — *2025 retail returns data*
- 77% would buy again after a good return; 71–89% would not after a bad one — *returns experience studies*
- UK merchants convert returns into exchanges at 5.8% against 17.1% in the US — *returns platform benchmarks*

**Proof in the repo:** `commerce/src/catalog.ts`, `commerce/src/seo.ts`, `commerce/GAPS.md`

---

<a id="why-we-open-a-pr"></a>

## Why every change we make opens a pull request first

**Promise.** A build you cannot review is a build you cannot trust. Pull requests, checks and a named owner are the cheapest quality system there is.

- Query: `website change management process agency`
- Audience: Business owners who have been burned by a freelancer editing live
- Service page: /services/business-automation
- Length: ~1400 words

**Outline**

1. The failure: changes nobody can see, on a site nobody can rebuild
1. What a pull request actually gives a non-developer: a diff, a preview, a checklist
1. Checks as the argument: 66 site tests, 79 studio, 119 commerce
1. The merge gate, and why the tool is not allowed to merge itself
1. What this costs, and when it is overkill

**Evidence**

- 4 tabs draft work; 0 of them can merge it — the gate is a human clicking the green button — *studio/src/App.tsx, studio/README.md*
- Preflight catches 4 classes of failure before a branch exists: collisions, missing dependencies, missing files, unresolved imports — *studio/src/installer.ts preflight*
- A build is deterministic: 32 CSV rows in, 50 pages out, 0 validation issues — *commerce/catalogue/scripts/build-site.mts*

**Proof in the repo:** `studio/src/processDoc.ts`, `studio/src/installer.ts`, `studio/PROCESSES.md`

---

<a id="buy-dont-build"></a>

## Buy the boring parts: four things no small business should build itself

**Promise.** Payments, analytics, a CMS and a marketplace integration are all worse when hand-built — and none of them is your differentiator.

- Query: `custom website vs off the shelf small business`
- Audience: Owners weighing a bespoke build against a template
- Service page: /services/website-design
- Length: ~1300 words

**Outline**

1. The four things not to build, and what to use instead
1. Never handle a card number: hosted checkout, always
1. Static pages generated from data beat a CMS for speed and crawlability
1. Buy the analytics; spend the time on checkout
1. The one thing worth building yourself: how you describe the product

**Evidence**

- 0 reasons to handle a card number yourself: Stripe Checkout, Adyen or PayPal take that liability — *commerce/GAPS.md 'Things not to build'*
- 50 static pages from 1 CSV beat a CMS for speed and crawlability — *commerce/catalogue/scripts/build-site.mts*
- A marketplace sync before order 1 automates a 2-minute job you do twice a day — *commerce/GAPS.md*

**Proof in the repo:** `commerce/GAPS.md`, `commerce/README.md`

---

<a id="fixed-price-website"></a>

## What a fixed-price website should include (and what 'from £795' must not hide)

**Promise.** A fixed price is only honest if the scope is enumerated: pages, revisions, hosting, analytics, accessibility, and who owns the code.

- Query: `fixed price website design uk what included`
- Audience: Buyers comparing agency quotes
- Service page: /services/website-design
- Length: ~1500 words

**Outline**

1. Why hourly billing punishes the client for asking questions
1. The scope list we would put in writing: pages, revisions, devices, hosting, handover
1. Accessibility and speed as deliverables with numbers attached
1. Who owns the repository, the domain and the analytics
1. Deposit, milestones and what happens if the brief changes

**Evidence**

- 94% of audited European ecommerce journeys fail WCAG checks — *accessibility audits*
- Tap targets below 24px and unlabelled fields are the common failures — *commerce/src/budget.ts auditMarkup*
- Performance budgets can be written into the build: LCP ≤2.0s, ≤120kB JS — *commerce/src/budget.ts*

**Proof in the repo:** `commerce/src/budget.ts`, `studio/PROCESSES.md`

---

<a id="llms-txt-worth-it"></a>

## llms.txt in practice: what we shipped, and what it changed

**Promise.** One plain-text file that states prices, delivery and policies is cheap, honest, and the easiest honest experiment in AI visibility you can run this week.

- Query: `llms.txt example`
- Audience: Technical marketers and agencies
- Service page: /services/ai-automation
- Length: ~900 words

**Outline**

1. What llms.txt is, and the argument against it
1. What goes in ours: canonical, facts, prices, policies, product links
1. llms-full.txt: the whole catalogue for a crawler that wants it
1. How to measure whether it matters without lying to yourself
1. What we would change now that it is shipped

**Evidence**

- 2 files — llms.txt and llms-full.txt — generated from the same data as the 50 pages — *commerce/src/seo.ts llmsTxt*
- Facts stated plainly in 6 lines: £3.95 delivery, free over £40, 30-day returns, VAT included — *commerce/catalogue/dist/llms.txt, generated*
- robots.txt names 6 crawlers explicitly rather than relying on a wildcard — *commerce/catalogue/scripts/build-site.mts*

**Proof in the repo:** `commerce/src/seo.ts`, `commerce/catalogue/scripts/build-site.mts`

---

<a id="testing-as-sales-proof"></a>

## What 287 tests look like to a client who cannot read code

**Promise.** Tests are the only claim in a proposal you can verify: they turn 'we care about quality' into a number that fails loudly when it is not true.

- Query: `how do i know my website was built properly`
- Audience: Buyers who cannot evaluate a codebase
- Service page: /services/business-automation
- Length: ~1100 words

**Outline**

1. Why 'it works on my machine' is not a deliverable
1. Three kinds of test this repo actually uses, with examples
1. The browser walk: 390px, no overflow, every tap target ≥24px
1. What a client can ask for: CI output, a preview URL, a test count
1. What a test cannot prove, and how to check that part yourself

**Evidence**

- 287 tests across three packages: 66 site, 102 studio, 119 commerce — *CI, this repository*
- The 287 tests assert shopper behaviour: £39 caps applied, basket totals to the penny, search tolerance — *commerce/src/affiliate.test.ts, siteModel.test.ts*
- 3 CI jobs run on every pull request; the claim is reviewable before it is merged — *GitHub Actions, .github/workflows/ci.yml*

**Proof in the repo:** `.github/workflows/ci.yml`, `commerce/src/affiliate.test.ts`, `studio/src/features.test.ts`

---
