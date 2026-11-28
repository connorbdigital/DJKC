# The research: five suppliers, Stripe at catalogue scale, and whether BigBuy can be linked

Companion to `SUPPLIERS.md` (who exists), `COMMISSION.md` (what the money does),
`FULFILMENT.md` (how an order is placed) and `SEO-AEO.md` (how it is found). This
is the depth behind the six-line answer: real links, real prices, and what each of
them will and will not do through an API.

Prices and policies below were read in November 2026 and are the sort of thing a
supplier changes without telling you. Every one of them should be re-checked at
sign-up, not copied from here.

---

## The five, in the order to approach them

### 1. Prodigi — <https://www.prodigi.com> · API docs <https://www.prodigi.com/print-api/docs/>

**What it is:** print on demand. Wall art, framed prints, apparel, mugs, phone
cases, printed in the UK (and in the US/EU/NL for foreign orders). Nothing exists
until somebody buys it.

**Cost:** no subscription, no minimum, pay per item. A framed A3 print lands
around £18–£30 of cost depending on frame and finish, so the sell price has to be
about 2.5–3×, not the 5× the homeware spreadsheet uses. Check the live price list
rather than the one in this file.

**What you get:** a catalogue with variants and print areas, per-country
fulfilment, and the only genuinely free API on this list.

- `POST https://api.sandbox.prodigi.com/v4.0/Orders` with `X-API-Key`
- `merchantReference` is your idempotency key — send the order id, and a retry is
  recognised instead of printed twice
- quote endpoint prices items by country and shipping method, which is exactly
  what `quote()` in `src/orders.ts` needs
- callbacks on create / shipment / completion, which map onto `accepted` /
  `shipped` / `delivered`
- cancellation only **before production starts** — say so on the product page,
  because it is not a policy you can soften later

**Why it goes first:** the sandbox means the entire chain — payment, order record,
supplier order, callback, tracking email — can be built and tested for nothing,
with no account, no stock file and no risk of a real parcel. It is the cheapest
way to find out that the plumbing is wrong.

**Why it is not the business:** print-on-demand margins are thin and the customer
can buy the same print from a hundred shops. Use it to prove the machine, then
sell physical goods through somebody else.

**Ask before signing:** is the UK production site the one that fulfils UK orders
(not the EU one); what is the dispatch cut-off; what are the printed-goods return
terms (usually none unless faulty); what do the callbacks look like when a
frame is out of stock.

---

### 2. Aosom — <https://www.aosom.co.uk/page/business>

**What it is:** a UK-warehouse home, garden and pet wholesaler — the closest match
on the list to what the catalogue currently sells (furniture, garden, storage).
Aosom's own trade page is the door; the shape of the deal is a trade account and a
product feed.

**Cost:** no subscription, trade prices, a minimum order value on some accounts.
Delivered by their carrier, usually next day.

**What you get:** a live feed with stock and UK dispatch, which is what makes a
same-day cut-off promise possible. **No public API.** Orders go into their portal
or by email.

**Why it is second:** it is where the margin is — a £49.99 shelf at a realistic
trade price leaves something worth having, unlike print on demand — and it is the
catalogue's own subject. The absence of an API is why the *manual adapter* in
`FULFILMENT.md` matters: a queue page and five minutes per order sells real stock
next week.

**Ask before signing:** cut-off time and whether it is real; blind parcel (no
Aosom invoice inside); who owns the returns label; whether the images are
licensed for your shop; what the feed refresh interval is; whether GTINs are
included (they usually are, and that alone fixes the Merchant Center warning in
`SEO-AEO.md`).

---

### 3. Dropship For You — <https://www.dropshipforyou.co.uk/datafeed-downloads/>

**What it is:** a UK dropship platform — a catalogue of several wholesalers behind
one account, with documented CSV and stock-feed URLs.

**Cost:** free to join, pay the trade price per item. Some catalogues have a
minimum order value.

**What you get:** the easiest feed on the list to automate: a documented URL, a
documented column set, and stock you can poll. Orders are placed in their portal —
no public order API.

**Why it is third:** breadth without a new account for every niche, and the feed
is the one that tests the importer against a supplier who documented it. Use it to
prove the import pipeline before asking Aosom for theirs.

**Ask before signing:** how often the stock file refreshes, whether a product can
be pulled mid-day, and whether the trade price includes VAT (it changes the margin
by 20% if you get it wrong).

---

### 4. Something Different (SDW Connect) — <https://www.somethingdifferentdropship.co.uk>

**What it is:** Swansea giftware and homeware wholesaler, trading since 1999, with
same-day dispatch on orders before 1pm. No minimum, no subscription.

**Cost:** trade price only.

**What you get:** CSV/XML catalogue with stock, price and images through SDW
Connect. Orders by portal or email.

**Why it is fourth, and why it is still worth it:** the fastest dispatch on the
list and the right kind of product for gifting, which is seasonal — a January
catalogue is not a June one. Small enough that a phone call gets a human.

**Ask before signing:** the 1pm cut-off in December, the returns address, and
whether the product photography can be used on your own domain or has to be
hot-linked.

---

### 5. BigBuy — <https://www.bigbuy.eu> · API docs <https://api.bigbuy.eu/rest/doc>

**What it is:** the Spanish wholesaler with the largest catalogue on the list
(400,000+ references), European and UK fulfilment, and the only documented REST
API *and* order API among the physical-goods suppliers here.

**Cost, as published in 2026:** Ecommerce Pack **€89/month**, Marketplace Pack
€119/month, B2B pack free; each with an **€89 sign-up fee**; connectors billed
separately. Some sources quote €69/month — the number moves, so treat €89 + €89 as
the planning figure.

**What you get:** catalogue, stock-by-handling-days, per-postcode carrier pricing,
order creation, and tracking — all over HTTP with a Bearer key, plus a sandbox at
`api.sandbox.bigbuy.eu`.

**The two things that decide whether it is worth it:**

1. **The fee is monthly and does not care whether you sell.** At the £3.71 net
   margin in `COMMISSION.md`, €89/month is about **24 orders a month of pure
   overhead** before you have made a penny. That is the whole argument for
   starting with Aosom and a manual queue.
2. **Prices are in euros and the shop sells in pounds.** BigBuy charges your trade
   account in EUR; a GBP retail price has to absorb the rate. That is why the
   adapter in `src/suppliers/bigbuy.ts` **refuses to quote carriage** until a
   conversion is configured — see the next section.

**Ask before signing:** which warehouse fulfils UK postcodes and what the real
transit time is (not the catalogue's 24–72h claim for Spain), whether the API key
survives a downgrade, and what the stockout rate has been on the categories you
intend to sell. Stockouts are the most common complaint in public reviews, and a
stockout after payment is a refund and an apology.

---

### And the one that is not a supplier: Awin — <https://www.awin.com>

Worth stating plainly because it is the easiest money on this page and it is a
different business. As a **publisher** (the affiliate), joining is free, the £5
deposit is refundable at first payout, and you apply to individual advertiser
programmes one at a time — home and garden benchmarks around 5–10%, 30-day
cookies, £20 payout threshold, net-30 terms.

It needs no stock, no order, no returns address and no API: a tracked link and a
page worth reading. What it does not do is build a shop — it earns commission on
somebody else's checkout. Mixing commission and margin in one spreadsheet is how
shop owners conclude they are profitable when they are not.

---

## Stripe with a thousand products

The question behind the question is "will Stripe fall over". It will not, because
it should not be holding the catalogue at all.

### Stripe is a payment processor, not a product database

There are two ways to build a Checkout session:

- **`price_data` inline** — send the name, amount and currency with the session.
  No Product, no Price, no sync, nothing to keep in step. This is what
  `lib/pricing.js` already does, and it means **1,000 products cost exactly the
  same as 10**: the catalogue lives in `catalogue/products.csv` and Stripe sees
  only what is in this basket.
- **Products and Prices** — create an object per SKU in Stripe. Fine for 10
  products, and a synchronisation problem at 1,000: a price change is now two
  writes that can disagree, and reporting is the only thing you gain.

So: keep `price_data`. If reporting ever demands Products, generate them from the
catalogue in a nightly job with idempotency keys — never by hand.

### The three real limits, and what each one means here

| Limit | What it is | What happens at 1,000 products |
| --- | --- | --- |
| **100 line items per session** (payment mode) | Stripe's documented maximum; it recommends consolidating beyond a few dozen | A 1,000-SKU catalogue is fine — a *basket* of 100 is the limit. Nobody buys 100 different things; a wholesale account would, so that path needs consolidation into one "Trade order (N items)" line plus our own record |
| **500 characters per metadata value**, 50 keys | Where the basket is remembered | `HG-1001x1,HG-1004x2` is about 10 characters a line, so ~40 products fit. The checkout omits it beyond that and the webhook reports that it could not rebuild the order rather than guessing |
| **Webhooks have no line items** | `line_items` is an "includable": the webhook never has it, and fetching it is a second API call (paginated, 100/page) | Avoided entirely: the order is rebuilt from `metadata.cart` and re-priced from the repository's catalogue. One fewer call and one fewer way to be wrong |

### What it costs

Published UK rates, November 2026 (<https://stripe.com/gb/pricing>):

| | Rate |
| --- | --- |
| Standard UK card | 1.5% + 20p |
| Premium UK card | 2.8% + 20p |
| EEA card | 2.5% + 20p |
| International card | 3.15% + 20p |
| Currency conversion | +2% when needed |
| Chargeback | £20 |
| Monthly fee | £0 |
| Stripe Tax | 0.5% no-code, or £0.40 a transaction by API |

Worked at volume, because the 20p is what hurts a cheap catalogue:

| A month of orders | Revenue | Stripe fee | Effective rate |
| --- | --- | --- | --- |
| 100 × £25 | £2,500 | £37.50 + £20 = **£57.50** | 2.3% |
| 500 × £25 | £12,500 | £187.50 + £100 = **£287.50** | 2.3% |
| 1,000 × £50 | £50,000 | £750 + £200 = **£950** | 1.9% |

And the number that matters more than any of them: on the demo shelf, net margin
is £3.71. A £50 sale pays Stripe **95p** — a quarter of the margin, before
delivery, packaging, ad spend or a single refund. Stripe is not expensive; a
catalogue with an 8.9% net margin is.

### Operational things that bite at scale, not at ten orders

- **Two webhook deliveries at once.** Stripe can send the same event twice in
  parallel, and both copies can read "no order yet" before either writes. The
  order id is deterministic (`ord_<session id>`), so you get one order, but both
  copies may try to place it with the supplier. The fix is a short Redis lock
  (`SET order:lock:<id> 1 NX EX 60`) around the placement step. **Not built yet**,
  and it is the first thing to add before going live.
- **Payouts are not instant.** Whatever Stripe's dashboard says for your account,
  assume the money arrives after the supplier has been paid — you are financing
  the gap.
- **Refunds are asynchronous.** `charge.refunded` reports the *cumulative*
  refunded amount; treating it as a delta refunds a partial refund again on every
  retry. `src/stripeWebhook.ts` computes the difference, and `src/orders.ts`
  refuses to give back more than was taken.
- **Disputes.** £20 and a deadline; the `history` array on each order — signed
  webhook, supplier reference, tracking — is the evidence pack.

---

## Can BigBuy's API be linked? Yes — and it is linked

`src/suppliers/bigbuy.ts` is a working adapter, tested against recorded shapes of
BigBuy's own responses (14 tests), with no key and no network:

| Interface | BigBuy endpoint | Notes |
| --- | --- | --- |
| `quote()` | `POST /rest/shipping/orders.json` | real carrier prices per country and postcode; picks the cheapest and reads the delivery window from `shippingService.delay` |
| `place()` | `POST /rest/order/check/multishipping.json` then `POST /rest/order/create/multishipping.json` | check-then-create, `internalReference` set to our order id |
| `parseCallback()` | — | BigBuy cannot call us; returns `null` rather than pretending |
| `tracking()` | `GET /rest/tracking/order/{id}.json` | polled, defensively parsed, raw body kept |

Three details in the code that are really decisions:

1. **A refusal inside a 200.** BigBuy reports "products have no stock" as
   `errors[]` with code `ER003` and status 409 in the *body*, not the HTTP status.
   Reading `response.ok` alone would book an order that was never placed. Out of
   stock is mapped to `retryable: false`; a 5xx is `retryable: true`.
2. **One basket, several orders.** Goods from different warehouses create one
   order per warehouse. The adapter returns the first reference and
   `additionalReferences` for the rest, so the order history keeps all of them.
3. **Euros.** `quote()` refuses without a conversion function, because inventing
   a GBP shipping price from a EUR cost is a promise the shop cannot keep. Pass
   `toShopCurrency` once you have decided the rate you will hold.

To switch it on you need: an Ecommerce Pack, a key, `BIGBUY_API_KEY` and
`SUPPLIER_NAME=bigbuy` on the commerce project, and a decision about the euro
rate. To test it before paying for anything: point `BIGBUY_API_BASE` at
`https://api.sandbox.bigbuy.eu`.

---

## What this changes about the plan

The chain is now real: `checkout.session.completed` → verified → order built and
re-priced → written to KV → handed to a supplier adapter → their answer recorded →
refund when there is nothing to send. What is still missing is not code:

1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the `ecommerce` project.
2. A KV/Redis store connected to that project (`KV_REST_API_URL`,
   `KV_REST_API_TOKEN`), without which the webhook refuses to answer 200 rather
   than lose an order.
3. A supplier account. Prodigi's sandbox needs one; BigBuy needs a paid pack.
4. The Redis lock on placement, before the first live order.
