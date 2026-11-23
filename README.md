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
- `PATCH /api/bookings` with `{ "id": "BK-…", "status": "confirmed" }` marks a date as booked; `requested` and `declined` are the other states.
- Both management calls need `BOOKINGS_TOKEN`:
  `curl -H "Authorization: Bearer $BOOKINGS_TOKEN" https://kaysie.sitebuildup.co.uk/api/bookings > bookings.csv`
  `curl -X PATCH -H "Authorization: Bearer $BOOKINGS_TOKEN" -H 'content-type: application/json' -d '{"id":"BK-4F2A9C","status":"confirmed"}' https://kaysie.sitebuildup.co.uk/api/bookings`

Confirming a request here does **not** email the guest — reply to them yourself, then mark the record. The site also never takes a deposit; the 50% deposit in the copy is still arranged between KC and the promoter. Availability reflects only what is stored, so keep statuses current or the calendar will drift. Without storage configured the endpoint returns 503 and the form falls back to the prepared email, saying plainly that nothing was sent.
