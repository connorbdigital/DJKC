# DJ KC — homepage and booking enquiries

A static React, TypeScript and Tailwind site for a North West-based house DJ and live vocalist. The demo deck synthesises loops locally with Web Audio; they are not recordings of performances.

## Develop and check

Use Node.js 22.12+ (CI uses Node 22) and npm. From the repository root:

```sh
npm ci
npm run dev        # local development
npm test           # interaction and calendar regression tests
npm run build      # strict TypeScript checks, then production bundle
npm run preview    # serve the production bundle locally
```

Publish `dist/index.html` to a static host after a successful build. `vite-plugin-singlefile` inlines the app, styles and imported images. Fonts are requested from Google Fonts with system fallbacks. No server or environment variables are required.

## Maintain the homepage

- `src/data.ts`: dates, packages, contact details, track definitions, testimonials and statistics. Confirm promotional claims, quotes, prices and profile links with the artist before publishing.
- Shows use venue-local calendar dates (`timeZone` as an IANA zone, `iso` as YYYYMMDD). Keep `day` and the display `date` consistent with `iso`. Set `startsAt` only for a confirmed start, with its correct UTC offset. Unknown times export as date-only; past dates move to the archive.
- `src/components/Music.tsx`: the downloadable text brief contains the bio and rider summary. Update it alongside any changes to the packages or rider. Full mixes and live footage must be requested separately.
- `src/components/Booking.tsx`: the form prepares an editable email draft to `BOOKING_EMAIL`. Visitors must send it in their mail app or copy the details to webmail. The site does not transmit, store, or confirm delivery of enquiries. Verify the destination mailbox before launch.
- `src/components/Footer.tsx`: links to artist profiles; **no** mailing-list subscription is collected. If a provider is added, confirm consent and handle service errors before displaying success. Never embed private provider credentials in this static bundle.

## Booking chat

The floating booking desk uses opaque, high-contrast messages. Its package, coverage and date shortcuts run locally with no credentials. Free-text chat sends the most recent conversation turns to the same-origin `/api/chat` function, which calls OpenAI. Chat does not send booking emails, check a diary or reserve dates. The UI keeps history only in memory. On a static-only host, during ordinary `vite` development, or when the provider fails, it clearly labels answers from the local guide instead.

To enable model replies, set **`OPENAI_API_KEY`** as a server-only environment variable for the desired Vercel environment and redeploy the repository (including `api/chat.ts`, not just `dist/`). Never use a `VITE_` prefix or place a key in chat, Git or browser code. Use `vercel dev` to exercise the function locally. Before enabling the public paid endpoint, configure provider budget alerts/limits and an edge rate limit for `POST /api/chat`; its built-in per-instance burst cap is not a distributed quota. Check that a typed question gets an **AI assistant** reply in preview before deploying to production.

## Browser colour

The mobile browser toolbar follows the section in view: `src/utils/themeColor.ts` maps each section to a toolbar colour, and a scroll listener updates `<meta name="theme-color">`. The static `theme-color` in `index.html` provides the first paint before React mounts. The logo itself stays brand pink everywhere so the mark and the favicon that search engines crawl never drift off-brand.

On a fine pointer (desktop, mouse or trackpad) the tab icon gently pulses between pink shades on a six-second loop at about 12 frames per second. The pulse pauses while the tab is hidden and is skipped entirely for `prefers-reduced-motion: reduce`, touch-only devices and browsers without `matchMedia`, which keep the static pink icon. Desktop tab-strip colour is controlled by the browser and operating system, so the icon is the only part the site can change there.

## Mailing list storage

`POST /api/subscribe` validates an address and stores it; `GET /api/subscribers` exports the list. Storage talks to Upstash's REST API directly, so there is no database dependency in `package.json`.

1. Create a Redis store (Vercel dashboard → Storage → KV/Upstash, or upstash.com) and connect it to the `djkc` project. Connection provides `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the handler also accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` if you set them yourself.
2. Redeploy. Addresses are kept in the Redis hash `kc:mailing-list` as `email → ISO opt-in timestamp`. `HSETNX` means a repeat sign-up never overwrites the original date.
3. Add a long random `SUBSCRIBERS_TOKEN` to download the list:
   `curl -H "Authorization: Bearer $SUBSCRIBERS_TOKEN" https://kaysie.sitebuildup.co.uk/api/subscribers > list.csv`
   (`?format=json` returns JSON instead.) Keep this token private; without it the export returns 503.

Without storage configured, `/api/subscribe` answers 503 and the pop-up falls back to a prepared email, so the visitor is never told they joined when they did not. Even so, run one real sign-up after setup and check it appears in the export, because a missing KV variable looks identical to a store outage from the browser.

Only the address and opt-in time are stored. Use them solely for DJ KC updates, include an unsubscribe reply route in every send, and delete on request — UK GDPR applies to this list.

## Booking requests

The enquiry form now files a real request instead of only drafting an email.

- `POST /api/bookings` validates the fields (name, email, venue, optional area, optional date within two years, package from the published tiers, message) and stores a record in the Redis hash `kc:bookings` with a reference such as `BK-4F2A9C`, status `requested` and a creation time.
- `GET /api/availability?date=YYYY-MM-DD` answers `open`, `requested` or `booked` for that date, based on stored records. It is aggregate only and never returns names or contact details. The form shows this beside the date field.
- On phones a pinned **Book now** bar sits at the bottom of the screen (`src/components/BookBar.tsx`). It appears past the hero, steps aside once the booking section is on screen, and tapping it lands on the form with the holding deposit already selected, so the route to payment is one choice. It lifts the chat launcher and sign-up card clear of itself.
- The form prices the job before it is sent. It shows the package's list price and a payment choice — no payment, the 50% holding deposit, or the full fee — and accepts a **suggested budget** from the enquirer (from £100 to £50,000), which overrides the list price for the quote.
- The payload carries `offer` (their budget) and `pay` (`none` / `deposit` / `full`). The response returns `paymentUrl`, `amount`, `mode` and `quotedAmount`. Payment without a number to charge is refused, so a custom enquiry must name a budget before it can pay.
- `PATCH /api/bookings` with `{ "id": "BK-…", "status": "confirmed" }` marks a date as booked; `requested` and `declined` are the other states.
- Both management calls need `BOOKINGS_TOKEN`:
  `curl -H "Authorization: Bearer $BOOKINGS_TOKEN" https://kaysie.sitebuildup.co.uk/api/bookings > bookings.csv`
  `curl -X PATCH -H "Authorization: Bearer $BOOKINGS_TOKEN" -H 'content-type: application/json' -d '{"id":"BK-4F2A9C","status":"confirmed"}' https://kaysie.sitebuildup.co.uk/api/bookings`

Confirming a request here does **not** email the guest — reply to them yourself, then mark the record. Availability reflects only what is stored, so keep statuses current or the calendar will drift. Without storage configured the endpoint returns 503 and the form falls back to the prepared email, saying plainly that nothing was sent.

## Payments, notifications and blocked dates

- **`POST /api/bookings` emails the desk** through Resend when `RESEND_API_KEY` and `NOTIFY_EMAIL` are set, with `reply_to` set to the enquirer so a reply goes straight back. Mail never blocks storage: the booking is saved first and `notified` reports whether the email left.
- **Deposits and full payments** run through Stripe Checkout (`api/deposit.ts`). The deposit defaults to 50% (`STRIPE_DEPOSIT_PERCENT`) and never goes below £1. `GET /api/deposit?session_id=cs_…` verifies the session with Stripe before writing `depositPaid`, `depositAmount`, `paymentMode` (`deposit` / `full`) and `paidAt` to the record. Verification is idempotent.
- **Blocked dates** live in `kc:blocked-dates` via `GET|POST|DELETE /api/blocked` (`{ "date": "YYYY-MM-DD", "reason": "…" }`), managed from the admin's Blocked dates tab. `/api/availability` reports `blocked` before it looks at bookings, and the form steers people to another date.
- **Mailing-list removal** is `DELETE /api/subscribers` with `{ "email": "…" }`, exposed as the Remove button on the admin's Mailing list tab, for GDPR erasure requests.
- **`/api/calendar`** serves a public read-only iCalendar feed of future shows — no contact details, no admin token.

There is no Stripe webhook yet, so a payment is only recorded when the buyer returns to the site. Anyone who pays and closes the tab leaves no record: reconcile in the Stripe dashboard until a webhook is added.

## Search and AI visibility

The homepage is a React app, so its words only exist after JavaScript runs. Most answer engines (and some crawlers) never run it. `scripts/build-static-pages.mts` runs automatically after `vite build` and writes real HTML into `dist/`:

- `/prices.html`, `/shows.html`, `/faq.html`, `/coverage.html`, `/about.html` — the facts, in text, each with its own structured data (`OfferCatalog`, `MusicEvent`, `FAQPage`, `PerformingGroup`).
- Three pages built around what buyers actually search: `/how-much-does-a-dj-cost.html` (the UK price question, with market ranges for party, wedding and singer-DJ bookings), `/wedding-dj.html` (wedding DJ with live vocals in the North West) and `/dj-hire-manchester.html` (local hire for club nights, parties, corporate and Christmas events). Each carries `Service` + `FAQPage` schema and links to the booking form.
- Tables stack with visible labels below 600px so prices stay readable on a phone.
- `sitemap.xml` listing every page, and `llms.txt` — a plain-text fact sheet for AI tools.
- `index.html` carries a `<noscript>` summary plus `PerformingGroup` + `WebSite` JSON-LD, and `robots.txt` names the major answer-engine crawlers and points at the sitemap.

The footer links every static page so nothing is orphaned. Edit `src/data.ts` (prices, shows, FAQs, areas) and rebuild — the pages follow automatically.

## Booking desk (admin)

`/admin.html` is a private, token-gated page for the booking requests and mailing list. It is not linked from the site and is disallowed in `robots.txt`, but anyone can open the URL — the data needs the token.

Set **`ADMIN_TOKEN`** in Vercel to a long random string. It is accepted by `/api/bookings` and `/api/subscribers` alongside the specific `BOOKINGS_TOKEN` / `SUBSCRIBERS_TOKEN`, so the desk can use one token for both. The page keeps the token in `sessionStorage` only, so closing the tab locks it again.

The desk shows awaiting/confirmed/declined counts, searchable bookings with a date, reference, venue, package, area, contact and message, and buttons to confirm, decline or reopen a request. Confirming updates the stored status (which feeds the public availability check) but **sends no email** — reply to the promoter yourself. CSV downloads for bookings and sign-ups use the same token.

`/share-preview.html` shows the Open Graph cards as WhatsApp/iMessage, LinkedIn/Facebook and X/Bluesky would render them, plus the gaps worth fixing. Both internal pages are static files in `public/`, so they need no build step and are excluded from the single-page bundle.
