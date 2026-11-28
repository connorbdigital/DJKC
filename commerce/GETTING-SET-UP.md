# Getting set up: Stripe, Prodigi, BigBuy, Aosom — and what £3.71 means

The companion to `RESEARCH.md` (what each supplier is), `FULFILMENT.md` (how an
order moves) and `SUPPLIERS.md` (who exists). This is the "what do I actually do
on Monday" version, in order, with the things I cannot do for you marked plainly.

Run `npm run readiness` in `commerce/` at any point — it prints exactly which
pieces are configured and the next one to do. The deployed shop answers the same
question at `GET /api/readiness`.

---

## First: three things called "the ecommerce pack"

Worth untangling, because two of them are mine and one is a subscription:

| What | Who does it | Status |
| --- | --- | --- |
| **The `ecommerce` Vercel project** — the shop, its checkout, its pages | already built | live at `ecommerce-two-psi-13.vercel.app`, **with no environment variables set at all** |
| **BigBuy's "Ecommerce Pack"** — a €89/month + €89 setup subscription they sell | you buy it, from BigBuy | not bought, and it cannot be "built": it is a contract with a wholesaler |
| **An ecommerce pack in the general sense** — payments, order records, a supplier, stock, email | code here + accounts there | the code is done; the accounts are the blocker |

So: I can build all the software, and I cannot create a Stripe key, a database,
a Prodigi account or a BigBuy subscription. Everything below is sequenced so that
the parts that need no money happen first.

---

## The £3.71, line by line

This is the real arithmetic on the demo shelf (`COMMISSION.md` has the working):

| Line | Amount | Why it is there |
| --- | --- | --- |
| Shopper pays | £49.99 | VAT included |
| Less VAT at 20% | −£8.33 | collected for HMRC, never yours |
| **Net revenue** | **£41.66** | |
| Trade cost of the goods | −£32.00 | typical trade price is 60–70% of the supplier's RRP |
| Carriage to the customer | −£4.50 | "free delivery" is free to the shopper |
| Card fee (1.5% + 20p) | −£0.95 | charged on the £49.99 **including** the VAT |
| Returns provision | −£0.50 | 4% of orders, ~£12 each |
| **Left over** | **£3.71** | 8.9% of net, 7.4% of the retail price |

Three things follow, and they are the whole business case:

1. **The card fee is a quarter of your margin.** 95p out of £3.71. On a £50 sale
   the percentage barely matters; the fixed 20p does. Small baskets are worse.
2. **Advertising eats it five times over.** At £0.60 a click and a 3% conversion
   rate, one sale costs about £20 in ads. Free traffic (search, a list, social) is
   not a nice-to-have — it is the only version of this that works.
3. **The fix is price, not volume.** Either sell at 4–5× the trade price instead of
   following the supplier's RRP, or sell at a basket size where carriage and card
   fees are a rounding error, or take commission instead of margin (Awin: about
   £4.00 on the same £49.99, with no stock and no returns).

BigBuy's €89/month is about **24 of these sales a month** before it has paid for
itself — with zero profit on any of them.

---

## Step 1 — Stripe (10 minutes, no money)

1. Create/log in to Stripe, and **stay in test mode** until an order has gone
   through end to end.
2. Developers → API keys → copy the **secret** key (`sk_test_…`).
3. Vercel → project **ecommerce** → Settings → Environment Variables → add
   `STRIPE_SECRET_KEY`, type **sensitive**, targets production + preview + development.
4. Redeploy, then open `/api/checkout` in a browser: it should say
   `"key":"set"` and `"webhook":"missing"`. That second half is step 2, and it is
   the difference between taking money and knowing what was bought.

Test card `4242 4242 4242 4242`, any future date, any CVC.

## Step 2 — the webhook (10 minutes, no money)

1. Stripe → Developers → Webhooks → **Add endpoint**:
   `https://<your-shop-domain>/api/stripe-webhook`
2. Subscribe to exactly three events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
3. Copy the endpoint's **signing secret** (`whsec_…`) into Vercel as
   `STRIPE_WEBHOOK_SECRET` (sensitive, all targets).
4. Redeploy. `/api/readiness` should now say `canTakeMoney: true` and
   `record orders: no` — because there is nowhere to write yet.

Without this, a paid order exists only in the Stripe dashboard. With it, every
paid basket becomes an order here, and Stripe stops retrying once it has been
recorded.

## Step 3 — somewhere to keep orders (5 minutes, free tier)

1. Vercel → Storage → create an **Upstash Redis** (KV) database, free tier.
2. Connect it to the **ecommerce** project — that sets `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` for you.
3. Redeploy, then place one test order with `4242…`. `/api/readiness` should show
   `record orders: yes`, and `/api/checkout` should say `"orders":"store"`.

At this point the shop takes money and remembers what was bought. Nothing is being
posted yet, which is exactly right — the first orders should be fulfilled by hand
while you watch what happens.

---

## Step 4 — Prodigi sandbox (30 minutes, free) ← do this next

**Why:** it is the only supplier with a free sandbox, so the whole chain can be
proven — price, order, callback, tracking — with no money and no parcel.

1. Create a Prodigi account: <https://www.prodigi.com> → sign up → dashboard →
   **API / integrations** → generate a **sandbox** key.
2. Pick one product from their catalogue you would actually sell (a framed print
   is the usual first). Note its **SKU**, e.g. `GLOBAL-CAN-16X20`.
3. Put a print-ready PNG or JPEG somewhere public (1200px+, sRGB). The shop's SVG
   placeholders **cannot** be printed, and the adapter refuses them by name.
4. In Vercel → **ecommerce** → Environment Variables:

   ```json
   SUPPLIER_NAME   prodigi
   PRODIGI_API_KEY sandbox_xxx
   PRODIGI_ITEMS   {"HG-PRINT-01":{"sku":"GLOBAL-CAN-16X20","asset":"https://your-host/art/print.png"}}
   ```

   `PRODIGI_ITEMS` is keyed by the SKU the order line carries
   (`HG-PRINT-01` here; check `catalogue/products.csv` for the real one).
5. Prove it from the terminal before trusting the webhook:

   ```bash
   cd commerce
   PRODIGI_API_KEY=sandbox_xxx \
   PRODIGI_SMOKE_SKU=GLOBAL-CAN-16X20 \
   PRODIGI_SMOKE_ASSET=https://your-host/art/print.png \
   npm run smoke:prodigi
   ```

   It prints the quote, the order id Prodigi gave, and the status. If Prodigi
   refuses, it says why — usually a wrong SKU or an asset that is not print-ready.
6. Then a real test order through the shop with `4242…`, and watch the order in
   KV move `paid → submitted`. The sandbox order appears in Prodigi's dashboard.

**Switch to live:** replace the key with a live one and change nothing else. A key
that does not start with `sandbox_` uses the live endpoint automatically;
`PRODIGI_API_BASE` exists only to override that.

**What Prodigi will not tell you:** a delivery estimate. Its quote carries a
shipping *cost* and no window, so the shop says "printed to order" rather than
inventing a date.

---

## Step 5 — BigBuy: how it works, and the steps to get it

**How it works.** BigBuy is a Spanish wholesaler. You pay for a pack, you get a
catalogue (400,000+ references), stock by warehouse, per-postcode carrier prices,
order creation and tracking — all over HTTP. You sell at your price; they charge
your account the trade price plus carriage and ship to your customer in a plain
parcel. One basket can split into several orders, one per warehouse.

**What it costs (published 2026):** Ecommerce Pack €89/month, Marketplace Pack
€119/month, B2B pack free — each plus an **€89 sign-up fee**, connectors extra.
Some pages quote €69; assume €89 + €89 and be pleasantly surprised.

**The steps to get it:**

1. Create a business account at <https://www.bigbuy.eu> — you will need a company
   name, VAT number and a delivery address for returns.
2. Choose the **Ecommerce Pack** and pay. API access requires an active pack; a
   free account cannot call the API.
3. In their control panel, generate the **API key** (Settings → API). Note whether
   you have a sandbox key too — `https://api.sandbox.bigbuy.eu` is where the
   testing happens.
4. On this site: `SUPPLIER_NAME=bigbuy`, `BIGBUY_API_KEY=…`, and either
   `BIGBUY_API_BASE=https://api.sandbox.bigbuy.eu` while testing or nothing for live.
5. Import their catalogue to see what the margin actually is before selling:

   ```bash
   cd commerce
   npm run feed -- --url "https://api.bigbuy.eu/rest/catalog/productsinformation.json?isoCode=en" --name bigbuy
   npm run site
   ```

   Their catalogue is JSON, so the importer may need a mapping — `SUPPLIERS.md`
   documents what the CSV importer expects and `src/importProducts.ts` is the
   column model.

**Three things that decide whether it is worth €178 in year one:**

- **Euros.** BigBuy charges in EUR; the shop sells in GBP. `quote()` refuses until
  you pass a conversion rate, because a shipping price invented from an exchange
  rate is a promise you cannot keep.
- **Multi-warehouse.** A basket can become two orders. The adapter records both
  references; your customer gets one email per parcel.
- **Stockouts.** The most common public complaint about BigBuy. Their API reports
  it as `ER003` inside a 200 response — the adapter maps that to a cancellation
  that owes a refund, so nobody is told a parcel is coming when it is not.

**My recommendation:** do not buy it yet. Prove the chain on Prodigi's free
sandbox, sell twenty things by hand from Aosom, and buy the pack when the manual
work is the bottleneck rather than the idea.

---

## Step 6 — Aosom on this site

**How it works here.** Aosom is a UK-warehouse wholesaler with a live feed and no
public API. That is not a blocker: the site already has everything needed to sell
their stock.

1. Apply for a trade account through
   <https://www.aosom.co.uk/page/business> — company details, VAT number, the shop
   URL (they will look at it), and ask for the **product feed URL**, **GTINs** and
   **image licence** in the same email.
2. Download the feed — never commit it:

   ```bash
   cd commerce
   FEED_URL="https://…" npm run feed -- --name aosom
   npm run site
   ```

   That writes a dated file into `feeds/`, records a redacted manifest entry
   (URL shape, bytes, SHA-256, row count, columns), and rebuilds the catalogue,
   the pages, the sitemap and the Merchant feed from it.
3. **Map the supplier's SKU.** Their product id becomes `line.supplierSku`, which
   is what `place()` sends. Until that mapping exists, orders wait in the manual
   queue — which is the correct behaviour, not a gap.
4. **Fulfil the first orders by hand.** Order arrives in `/api/stripe-webhook`,
   lands in KV as `paid`, someone places it in Aosom's portal and writes the
   reference back. Slower than an API and available next week.
5. When the manual step is genuinely painful, the adapter is a day's work: BigBuy's
   and Prodigi's are both in `src/suppliers/` as templates.

**What the site gives you for free once their feed is in:** real stock (so the
"out of stock" pages stop lying), their GTINs (which fixes the Merchant Center
warning in `SEO-AEO.md`), and a real dispatch cut-off to put in the delivery
promise instead of a placeholder.

---

## The order I would do it in

| When | What | Cost | Why now |
| --- | --- | --- | --- |
| Today | Stripe keys, webhook, KV | £0 | no money changes hands without these three |
| Today | `npm run readiness` until it says "nothing missing" | £0 | it names the next thing, rather than guessing |
| This week | Prodigi sandbox + `npm run smoke:prodigi` | £0 | proves the whole chain with no parcel |
| This week | One test order end to end, then a refund | £0 | proves the refund path before a customer needs it |
| Next | Aosom trade account + feed import | £0 | real stock, real GTINs, real margins |
| Next | 20 orders by hand | £0 | you learn where the manual work actually hurts |
| Later | BigBuy Ecommerce Pack | €178 in year one | only when volume pays for it |
| Any time | Awin publisher account | £0 | commission needs nothing built |

## What "working" looks like

- `/api/readiness` → `canTakeMoney: true`, `canRecordOrders: true`, and either
  `canFulfilAutomatically: true` or an honest "fulfil by hand".
- `/api/checkout` → `"key":"set"`, `"webhook":"set"`, `"orders":"store"`.
- A test order appears in KV with `history` showing `pending → paid → submitted`.
- A refund in Stripe moves the same order to `refunded` without a second refund.

Until all four are true, the shop is a demonstration — a good one, with working
pages, real prices and honest policies, but a demonstration. The four things
between here and a business are all accounts and clicks, not code.
