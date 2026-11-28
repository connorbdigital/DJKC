# From a paid basket to a parcel

A shop that takes money and does nothing else is a donations page. This is the
missing middle: what happens in the minutes after Stripe says "paid", who is told,
what they are told, and what the shop does when the answer is no.

Written against what exists in this repository: `api/checkout.js` creates the
Stripe session, `src/orders.ts` is the order and the supplier contract, and
nothing yet places an order with anybody.

## The chain

| # | Stage | Who does it | State today |
| --- | --- | --- | --- |
| 1 | Basket → Stripe Checkout Session | `commerce/api/checkout.js` | Built; returns 503 until `STRIPE_SECRET_KEY` is set on the `ecommerce` project |
| 2 | Stripe says `checkout.session.completed` | Stripe → our webhook | **Missing.** No endpoint, so a paid order exists only in Stripe |
| 3 | Write the order down | our database, via `applyEvent(order, paid)` | **Missing.** `src/orders.ts` has the rules; there is no store |
| 4 | Ask the supplier to ship it | a `SupplierAdapter` | **Missing.** Interface defined, no implementation, no account |
| 5 | Supplier accepts / refuses | their callback or a poll | **Missing** |
| 6 | Tracking reaches the customer | email from stage 4's answer | **Missing.** No email at all today |
| 7 | Refund when it cannot be fulfilled | Stripe refund + `applyEvent(…, refunded)` | **Missing**, but the state machine already refuses to let it drift |

Stage 2 is the one that matters most, and it is the cheapest. Until it exists,
every sale is a manual reconciliation in the Stripe dashboard.

## The state machine

`src/orders.ts`. Pure functions, no database, no Stripe, no supplier — so the
rules can be tested (22 tests in `src/orders.test.ts`) before there is anything to
break.

```
pending ──paid──▶ paid ──submitted──▶ submitted ──accepted──▶ accepted ──shipped──▶ shipped ──delivered──▶ delivered
   │                │                     │
   │                └──refused/cancelled──┴──▶ cancelled ──refunded──▶ refunded
   └──refunded (nothing was owed)
```

Four rules earn their keep, and each one is a test:

- **A repeated `paid` for the same Stripe session changes nothing.** Stripe retries
  for up to three days. The second delivery must return 200 and stop, not create a
  second order or a second supplier submission. A *different* session paying an
  order that is already paid is refused, because that is money we cannot explain.
- **A retried submission with the same supplier reference changes nothing** — the
  supplier saying yes twice is not two parcels.
- **Out of stock is a `refused` event, not an error page.** It becomes `cancelled`,
  `nextStep()` returns `refund`, and the customer is told before they ask.
- **`refunded` is terminal.** A dispatch callback arriving afterwards is written to
  the history and ignored, so nobody gets told their money is back *and* their
  parcel is on its way.

`nextStep(order)` is the shop's to-do list, derived rather than stored: `submit`
for a paid order, `refund` for a cancelled one that still owes money, `wait` once
it is with the supplier.

## Three routes, only one of which is a supplier order

Worth repeating from `COMMISSION.md` because the wiring is different in each:

| Route | Who takes the money | Who ships | What you get | Does checkout place a supplier order? |
| --- | --- | --- | --- | --- |
| **Resell** (buy at trade, sell at retail) | you, on your Stripe | the supplier, blind | the margin: £3.71 on the demo shelf, 8.9% of net | **yes** — this is what `SupplierAdapter` is for |
| **Marketplace** (list on their site) | them | them | 5–20% of the sale as a fee to them, or to you | no — their checkout, their order |
| **Refer** (affiliate) | their own shop | them | 5–10% commission, no stock, no support, no refunds | no — you send the click, they do the rest |

So "connect payment so the site buys from the supplier automatically" is the
resell route only. The other two need a link and a tracking parameter, not an API.

## The supplier contract

`SupplierAdapter` in `src/orders.ts`, three methods:

```ts
quote({ lines, address })  → { shippingMinor, etaDays } | { reason }
place({ orderId, lines, address }) → { supplierReference } | { reason, retryable }
parseCallback(payload)     → OrderEvent | null
```

`quote` is what makes an honest delivery promise possible *before* the money is
taken: a real shipping price for a real postcode, and an ETA the supplier actually
committed to — or `null`, rather than a number invented to look reassuring.

`retryable` is the difference between a 503 we should retry in five minutes and an
address the supplier will never accept.

## The first adapter: Prodigi, and why

Print-on-demand is the right first automation because it removes the two hardest
parts of dropshipping: there is no stock to sync, and every item is made after it
is sold, so "out of stock" mostly cannot happen.

- `POST https://api.sandbox.prodigi.com/v4.0/Orders`, header `X-API-Key`; a sandbox
  exists, so the whole chain can be built and tested for free with no real parcel.
- `merchantReference` makes the call idempotent — pass our order id, and a retry is
  recognised rather than duplicated.
- A quote endpoint prices items by country and shipping method, which maps onto
  `quote()`.
- Callbacks on create / shipment / completion map onto `accepted`, `shipped`,
  `delivered`. v5's callback format is the v4 one, and per-order callbacks are how
  it is done (v5 draft orders exist but webhook subscriptions do not).
- Cancellation is only possible before production starts. That is a real
  constraint, so the shop must say so on the product page rather than discover it
  at the refund.

Docs: <https://www.prodigi.com/print-api/docs/> · sandbox:
<https://api.sandbox.prodigi.com>.

## The second: BigBuy, and what it costs

The only supplier on our shortlist with a real, documented REST catalogue *and*
order API:

- Auth `Authorization: Bearer <key>`; base `https://api.bigbuy.eu`, sandbox at
  `api.sandbox.bigbuy.eu`; docs <https://api.bigbuy.eu/rest/doc>.
- Catalogue: `GET /rest/catalog/productsinformation.json?isoCode=…`.
- Orders: validate with `POST /rest/order/check/multishipping.json`, then create
  with `POST /rest/order/create/multishipping.json` (`internalReference`,
  `language`, `paymentMethod`, `shippingAddress`, `products[{reference,quantity}]`).
  The check-then-create pair maps onto `quote()` then `place()`, and
  `internalReference` is our order id.
- Shipping: `POST /rest/shipping/orders` prices carriers per country and postcode.
- **API access requires an active Ecommerce package**, and goods ship from multiple
  warehouses, so one basket can become several supplier orders. Both facts change
  the arithmetic in `COMMISSION.md`, so the plan has to be paid for by volume that
  does not exist yet.

## The adapter that is a person

Aosom, Something Different and most UK wholesalers will give you a CSV, a login
and a next-day cut-off, and no API. That is not a reason to leave them out. The
same interface, implemented as a queue page in the admin: order appears, someone
places it in the supplier's portal, pastes the reference back, and the state
machine advances. It is slower, it is auditable, and it means the shop can sell
real stock next week rather than after an integration project.

Build this **second**, not last: it is how the first ten orders happen.

## Failure modes, and what the shop does

| What happens | What the customer sees | What the shop does |
| --- | --- | --- |
| Supplier is down when we try to place the order | nothing yet — it is still `paid` | retry with backoff; after a few hours, flag it for a human; never tell the customer it shipped |
| Out of stock after payment | apology + refund, same day | `refused` → `cancelled` → `refund`; the product is hidden or its availability corrected |
| Partial dispatch (two parcels, two warehouses) | one email per parcel, each with its own tracking | one order, several shipments — this is the reason `tracking` is a field and not a note |
| Price or shipping differs from what we charged | the charged price stands | we absorb it or we stop selling the line; never re-charge |
| Address the supplier refuses | ask for a correction or refund | `retryable: false` → the shop asks before cancelling |
| Return requested inside 14 days | returns address, no argument | refund on receipt; the supplier's returns window is the shorter of the two |
| Chargeback | evidence pack | order history *is* the evidence pack: timestamps, supplier reference, tracking |

The history array is not decoration. It is the answer to "where is my order" and
the defence in a chargeback, and it is why events carry a timestamp rather than
just a status.

## What to build, in order

1. **A webhook and a record.** `api/stripe-webhook.js`, signature verified,
   `applyEvent(paid)`, order written down. Then an email. This alone turns a
   payment into an order. Needs `STRIPE_WEBHOOK_SECRET` on the `ecommerce`
   project. *(No supplier required.)*
2. **The manual adapter** and a queue page, so a human can fulfil the first real
   orders from a wholesaler's portal.
3. **Prodigi**, end to end in the sandbox, then live: quote → place → callback →
   tracking email. This is the first order the site places by itself.
4. **BigBuy catalogue**, if and only if the Ecommerce package is paid for and the
   £3.71 margin survives it.
5. **Stock and price sync** for anyone shipping physical stock — last, because it
   is the most work and the least visible.

Nothing above needs anything from a supplier except, at step 2, an account and a
cut-off time. That is deliberate: the chain should be finished before it is
connected to anybody.

## Secrets

| Name | Where | What breaks without it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | project `ecommerce` | checkout returns 503 |
| `STRIPE_WEBHOOK_SECRET` | project `ecommerce` | every webhook is rejected as unsigned, so no order exists |
| `PRODIGI_API_KEY` | project `ecommerce` | print items cannot be ordered |
| `BIGBUY_API_KEY` | project `ecommerce` | catalogue and orders stop |
| `RESEND_API_KEY` (or equivalent) | project `ecommerce` | no confirmation, no tracking email |

Set as `sensitive` on production + preview, never in the repository, never in a
`NEXT_PUBLIC_`-style variable.
