# What a real store has that this one does not

A checklist written against the framework as it stands (November 2026): `money`,
`catalog`, `search`, `cart`, `checkout`, `seo`, `budget`, the CSV importer, the
feed exporter and the static catalogue builder. Everything below was compared
against what Amazon, Argos, John Lewis, Wayfair, Shopify's default theme and
WooCommerce do out of the box.

Three verdicts, used strictly:

- **Have** — it is in `commerce/`, tested, and does the job.
- **Partial** — the model or the policy exists, but nothing a shopper could use.
- **Missing** — it does not exist here at all.

Effort is a rough size for one person: **S** (a day), **M** (a week), **L** (a
month or more).

---

## 1. Taking money

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Payment provider | Stripe, Adyen, PayPal, Klarna, Apple/Google Pay | Nothing in `commerce/`. The DJ site's `api/deposit.ts` has a working Stripe Checkout pattern that could be pointed at an order | **Missing** | Without it there is no shop, only a catalogue | M |
| Wallet buttons | Apple Pay / Google Pay express at top of checkout | — | **Missing** | Mobile express wallets are consistently the cheapest conversion win in checkout testing | S, once payments exist |
| Order record | An order with lines, totals, tax, address, status | Cart prices but nothing is written | **Missing** | No order means no refund, no support, no accounts, no reporting | M |
| Webhook + receipt | Stripe webhook → order confirmed → email | — | **Missing** | A payment that is not recorded is a payment you will argue about | S |
| Fraud / bot protection | Risk scoring, 3-D Secure, rate limits | — | **Missing** | Card testing attacks hit small shops first | S–M |
| Saved cards / subscriptions | Provider tokens | — | **Missing** | Needed only if you sell repeat purchases | M |

## 2. The checkout itself

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Guest-first flow | Guest by default, account optional after | Specified and audited in `checkout.ts` (field count, order of steps, no forced account) | **Partial** | Forced accounts are one of the top abandonment reasons measured; the policy is right, the UI is not built | M |
| Address capture + validation | Postcode lookup, address book | — | **Missing** | Wrong addresses are the most expensive kind of support ticket | S–M |
| Delivery choice at checkout | Standard/express/nominated day/collect | `cart.ts` applies one delivery policy | **Partial** | "Extra costs at the last step" is the single largest abandonment reason; the shopper must see delivery before paying | M |
| Payment-method choice | Card, wallet, BNPL, gift card | — | **Missing** | No preferred payment method is cited by 8–22% of abandoners | S, with payments |
| Error handling | Inline, field-level, no data loss | Policy in `checkout.ts` audit | **Partial** | 17% abandon after an error | S |
| One-page vs multi-step | Both are fine if short | Policy: keep under ~12 fields | **Partial** | US average was 11.3 fields in 2021 and rising | — |
| Express checkout | Shop Pay / PayPal express / Amazon Pay | — | **Missing** | Express checkout often beats any optimisation of your own form | S |

## 3. Accounts and after-sales

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Accounts, login, password reset | Email + password or magic link | — | **Missing** | Only needed once orders exist; guest-first means it can stay optional | M |
| Order history / tracking | "Where is my order" | Calendar feed and booking desk exist for the DJ site only | **Missing** | WISMO is the most common contact reason in every retail support study | M |
| Returns portal (RMA) | Self-serve return, label, exchange | `returnPolicy` modelled and in JSON-LD | **Partial** | 77–97% will buy again after a good return; 71–89% will not after a bad one | M |
| Refunds / partial refunds | Provider + order record | — | **Missing** | Follows from orders | S |
| Cancellations / edits | Before dispatch | — | **Missing** | Follows from orders | S |
| Support inbox / chat | Chat, contact form, help centre | The DJ site has a booking chat; nothing in `commerce/` | **Partial** | Answering the same dozen questions is the cheapest support saving there is | S to copy the existing chat |

## 4. Product pages and merchandising

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Variant picker | Size/colour swatches, per-variant stock and image | Variants modelled with options, stock, GTIN, compare-at | **Partial** | The model is there; no UI selects a variant | S–M |
| Gallery / zoom | Multiple images, alt text, zoom | Images are a list with alt text; the built pages show one | **Partial** | Product image is the LCP element on most product pages | S |
| Reviews and ratings | Star summary, photos, Q&A, moderation | — | **Missing** | Reviews (20+, 4.2+) are the most universal signal in AI-shopping recommendations, and `aggregateRating` is a required-ish schema field | M |
| Recommendations | Related, bought-together, recently viewed | `relatedProducts()` puts same-department items on every product page | **Partial** | Basket-size work, not conversion work | M |
| Bundles / kits | "Frequently bought together" pricing | — | **Missing** | — | M |
| Wishlist / compare | Save for later, compare table | — | **Missing** | Small, cheap, useful if you sell considered purchases | S |
| Stock messaging | "Only 2 left", back-in-stock alerts | `stockLabel()` prints "Only 3 left" and "Out of stock — back soon" from the supplier file; no back-in-stock alert | **Have** (messaging) | Honest scarcity is fine; fake countdowns are not | S for the alert |
| Size guides / specs | Tables, fit notes | `pageMeta` and specs exist in the catalogue pages | **Have** | — | — |
| Rich product schema | Product, Offer, ReturnPolicy, shipping, GTIN | `seo.ts` builds Product/Offer/ReturnPolicy; catalogue emits it | **Have** | Complete markup is ~6× more likely to be quoted by AI agents | — |

## 5. Finding things

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Typo-tolerant text search | Synonyms, stemming, "did you mean" | `search.ts`: typo tolerance, never dead-ends | **Have** | 70% of searches fail on synonyms; search users convert several times better | — |
| Facets and filters | Category, price, size, colour, brand | — | **Missing** | Faceted navigation is absent on a large share of mid-size shops | M |
| Category / collection pages | Landing pages, sorting, pagination | Twelve department pages with their own title, description, `CollectionPage` schema and FAQs; no facets or pagination yet | **Have** (pages) | Category pages are what rank for commercial queries | M for facets |
| Zero-result reporting | Log the searches that found nothing | — | **Missing** | It is the cheapest merchandising research you will ever get | S |
| Autocomplete | Suggestions as you type | Only ~34% of shops have useful autocomplete; not here either | **Missing** | — | S |
| Personalisation | Recently viewed, tailored order | — | **Missing** | — | L |

## 6. Marketing, retention and measurement

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Promotions / vouchers | Codes, spend thresholds, free-shipping rules | `cart.ts` applies discounts deterministically; no code entry, no gift cards | **Partial** | Deterministic maths is the hard part and it is done | S |
| Gift cards | Sellable balance | — | **Missing** | Cash up front, and a gift that brings a new customer | M |
| Abandoned cart recovery | Email/SMS sequence | — | **Missing** | Needs orders and email | M |
| Mailing list | Sign-up, export, GDPR delete | Exists in the Studio library and the DJ site, not in `commerce/` | **Partial** | — | S to copy |
| Reviews/email automation | Klaviyo-style flows | — | **Missing** | — | L |
| Analytics + consent | GA4, server-side events, cookie banner | — | **Missing** | You cannot audit a checkout you do not measure; consent is a legal requirement in the UK/EU | M |
| Feed destinations | Google, Meta, TikTok, Pinterest | Google Merchant feed written and validated | **Partial** | One format done properly; Meta/TikTok are near-copies | S each |
| Affiliate / referral | Codes and tracking | `src/affiliate.ts` holds the rates, caps and gates for Amazon, AliExpress, eBay and Aosom, plus `routeFor()`. No link cloaking, no click logging, no attribution | **Partial** | Referring out is the cheapest route to first revenue when there is no stock and no checkout | M for the wiring |

## 7. Money, tax and law

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| VAT-inclusive pricing | UK consumer prices include VAT | `money.ts` treats prices as VAT-inclusive and formats once | **Have** | — | — |
| Tax engine | Per-line rates, reduced rates, US sales tax, EU OSS | Single-currency GBP assumption | **Missing** | Selling abroad without it is a compliance problem | L |
| Multi-currency | Local pricing, FX rounding | One currency per product, no FX | **Missing** | Only matters once you ship abroad | M |
| Invoices | Downloadable VAT invoice | — | **Missing** | Business buyers ask; UK VAT rules require records | S–M |
| Distance-selling rights | 14-day cancellation, model cancellation form | Return window modelled, not the statutory text | **Partial** | — | S |
| GPSR / EPR | Responsible person named, packaging registration | Noted in `SUPPLIERS.md` as a supplier question | **Missing** | Selling into the EU without it is now a listing risk | S to document, M to operate |
| Accessibility | WCAG 2.2 AA | `budget.ts` sets contrast, target-size and focus budgets; the catalogue pages are semantic HTML | **Partial** | Suits against ecommerce keep rising; 94% of audited EU checkouts fail | M to audit properly |
| Cookie consent | Banner + preference store | — | **Missing** | Required if you add analytics | S |

## 8. Running it

| Thing | Big stores | Here | Verdict | Why it matters | Effort |
| --- | --- | --- | --- | --- | --- |
| Admin for products/orders | CRUD, bulk edit, import | CSV import is the only way in; the DJ site's desk is bookings-only | **Partial** | Editing a price should not need a rebuild | M |
| Fulfilment / shipping integration | Carrier labels, tracking numbers | — | **Missing** | Only worth it past a few orders a day | M–L |
| 3PL / warehouse | Stock sync, pick-pack | — | **Missing** | — | L |
| Marketplace sync | eBay, Amazon, OnBuy, The Range | — | **Missing** | — | L |
| Accounting export | Xero/QuickBooks | `products.json` and order-shaped JSON only | **Missing** | — | S once orders exist |
| Audit log / roles | Who changed what | The Studio's token gate only | **Missing** | Matters the day someone else touches the shop | S |
| Backups | Point-in-time restore | — | **Missing** | — | S |
| Performance | CDN, image pipeline, cache headers | `budget.ts` fails a build on LCP/CLS/INP/bytes; catalogue pages are static | **Partial** | 100ms of LCP is worth roughly 3.5% conversion on Shopify's own data | M (images are the work) |
| Uptime / error monitoring | Sentry, status page | — | **Missing** | — | S |

---

## The five to build next, in order

1. **Payment + order record + confirmation email.** Nothing else matters until a
   shopper can pay and you can prove what they bought. Stripe Checkout, a webhook,
   an order hash in KV, and one email. The DJ site already has the pattern.
2. **Delivery promise before payment.** Choose the carrier rule, show the date and
   the price above the pay button, and keep the stock check honest. Extra costs at
   the last step are the largest measured cause of abandonment.
3. **Returns portal and the two emails.** Policy is modelled; make it executable.
   A good return buys the next order, and the statistics on that are unusually
   consistent.
4. **Reviews with a rating schema.** Cheapest trust you can buy, and it unlocks a
   signal every AI shopping agent looks for.
5. **Faceted category pages and zero-result logging.** Turns the catalogue into
   something browsable, and tells you what to stock next.

If a shopper can pay yet is not the plan, the order changes: **wire the affiliate
links first.** `src/affiliate.ts` already says which programmes pay what, and a
catalogue of crawlable pages is a legitimate referral asset without a card
processor behind it — but only if the clicks are tracked, which they are not.

## Things not to build

- **A card form.** Never handle card numbers. Stripe Checkout or an equivalent
  hosted page, always.
- **A CMS.** Static pages generated from a data file are the feature, not a
  limitation — they are why the catalogue is crawlable.
- **Your own analytics stack.** Buy the boring one; spend the time on the checkout.
- **A marketplace sync before you have orders.** It is a month of work to automate
  a job you are doing by hand twice a day.

## What this means for the Studio

Two capabilities now install what the store needs today — `store-core` (pricing,
catalogue model, cart, checkout audit, structured data, budgets) and
`supplier-catalogue` (CSV import, feed export, static pages) — bundled as the
**Open a product store** pack. The list above is the backlog those two do not
cover; each row is a candidate for the library once it exists as working code.
