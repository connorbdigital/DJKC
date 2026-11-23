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
