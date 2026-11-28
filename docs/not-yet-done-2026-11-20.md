# Everything suggested that is not done yet

*2026-11-20. An inventory, not an apology: what has been raised in this project and
still is not true. Ordered by what it costs to leave undone.*

## Blocks a sale, or the law

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 1 | **Shop checkout** | Built and priced on the server (`api/checkout.js`); it answers 503 until `STRIPE_SECRET_KEY` is on the **ecommerce** project. With the key it is a real Stripe page — see [checkout-and-pitch](checkout-and-pitch-2026-11-20.md). | S (the key) |
| 2 | **Privacy notice, terms of sale, cookies, accessibility statement** | None exist on either site, and both collect names and emails. | S |
| 3 | **SiteBuildup has no prices** | Competitors publish ranges; "contact for a quote" reads as expensive. Packages are drafted in [sitebuildup-clients](sitebuildup-clients-2026-11-20.md), not published. | S |
| 4 | **No proof of work anywhere** | No case study, no testimonial, no number. Both sites describe; neither demonstrates. | M |
| 5 | **Google Business Profile** | Not claimed, so a local search finds nothing. | S |

## The two spaces

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 40 | **The Anything scan, half confirmed** | The account read is now real: 89 projects, the top one *Digital Solutions Marketing Agency* (`digital-solutions-marketing-449`, published at sitebuildup.co.uk, 505 modules). What is still unconfirmed is the spaces' own scan — the `scan:anything — N projects, M parts` line — which has only ever been seen against a 3-app / 60-part mock. | S |
| 45 | **The build-time scan is unverified against the real API** | Half answered: a build in the `studio` project **does** have the key in scope and **can** reach `api.anything.com` (it read `/me` and the project list, then sent the brief — see [anything-brief-sent](anything-brief-sent-2026-11-20.md)). Still unconfirmed: whether the real `files` array is what the spaces expect, until a deploy prints `scan:anything — N projects, M parts`. | S |
| 41 | **The City has no memory** | No minimap, no "4 of 13 opened", no remembered position. The Atlas remembers its camera; the City always starts at the entrance. | S |
| 42 | **The building is bare** | Rooms, walls, doors, plinths. No windows, no stairs, nothing on the walls, one storey. | M |
| 43 | **A low-end phone is untested** | The City holds a laptop frame with unlit ceilings and emissive orbs, after 60+ point lights proved unusable. No measurement on real hardware. | S |
| 44 | **The City and the Atlas do not share state** | Opening something in the City does not mark it in the Atlas, or the reverse. | S |

## The shop

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 6 | **A real supplier account** | `commerce/SUPPLIERS.md` documents ten feeds; the catalogue is invented. No trade account, no sample order. | M |
| 7 | **Real product photography** | 33 generated SVG placeholders, honest but not sellable. | M |
| 8 | **Order record and confirmation email** | Checkout exists; nothing writes the order down or mails it. Stripe's receipt is the only confirmation, and the Stripe dashboard the only record. | M |
| 9 | **Analytics with consent, and four named events** | Nothing measured on either site. | S |
| 10 | **Shipping choice** | "Free over £40" is now enforced in the basket and in the Stripe session. Standard only: no express, no nominated day, no collection. | M |
| 11 | **Stock from a feed, not a column** | Stock is a CSV column, checked at build; nothing syncs it. | M |
| 12 | **Custom 404, installable shop (manifest), Core Web Vitals** | None. | S each |
| 13 | **A nicer domain than `ecommerce-two-psi-13.vercel.app`** | The Vercel project name was taken; add a domain and change one constant. | S |

## The Studio and the Atlas

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 14 | **~~Anything projects, verified live~~ Done** | **Verified 20 Nov, from a build that could reach the API:** `ANYTHING_API_KEY` is the only key configured (production, preview and development), and it answers **200** — `/v0/api/me` names the account and two organizations, `/v0/api/projects` returns **89**. The 401 the pulse used to report came from the duplicate `Anything_Key`, which is no longer there. | Done |
| 15 | **Rate-limit `/api/chat`** | An unauthenticated endpoint that spends money. The one item that can cost you overnight. | S |
| 16 | **The Agent's key on previews** | `ANTHROPIC_API_KEY` is production-only, so the Agent refuses on a preview deployment. | S |
| 17 | **Orrery and Constellation looks** | City, Blueprint, Observatory and Nebula ship; the other two directions from the earlier list do not. | M each |
| 18 | **Real-device testing** | Everything is checked in headless Chromium at 390 and 1500 wide. No iPhone, no Android, no Safari. | S |
| 19 | **WebXR with a headset** | "No headset" is the honest state of the VR button in this environment. | — |
| 20 | **A deploys tab, server-side projects, the physical-device todo** | Still open on the shelf, as they were before this week. | M |
| 21 | **Search synonyms and typo tolerance** | Site search matches substrings and nothing else. | S |
| 22 | **The pitch list lives in one browser** | Sheets, statuses and the email draft are real, but they sit in `localStorage`: one device, clearable, no sync, no team. Fine for one person prospecting; not a CRM. | M |
| 23 | **The audit endpoint has no rate limit** | `/api/site` fetches any public URL on request, and the pitch sheet sends five at once. A per-IP limit is the next thing before it is public. | S |
| 24 | **One page is the only length** | A shop and a one-page brochure get the same sheet, with different packages. The faults differ more than the layout does. | S |
| 31 | **A page whose links are built by JavaScript** | A project's space reads the anchors in the HTML. If a site draws its nav in script, the room shows one ring and few streams — and says so. | M |
| 32 | **The space reads pages when it opens** | Up to four pages are fetched per visit, which is fine for a handful of projects and would not be for fifty. Nothing is cached between visits. | S |
| 33 | **Anything was read-only, on purpose** | `/me`, `/projects` and one project's detail are the only reads. Since 20 Nov there is one write: `POST …/{id}/generate`, called from the Anything tab to send an audit brief. Create, duplicate, publish and delete remain deliberately unused — see [anything-inventory](anything-inventory-2026-11-20.md). | Changed 20 Nov |

## Bigger things said out loud, still only said

| # | What | Where it stands |
| --- | --- | --- |
| 25 | **A pitch sheet generated from an audit** | Built: Studio → Pitch sheet, printable and pasteable — see [checkout-and-pitch](checkout-and-pitch-2026-11-20.md). What is missing is everything around it (items 22–24). |
| 26 | **A package builder** | Four offers are priced by hand in a doc. |
| 27 | **Case-study templates with metric fields** | Described in [sitebuildup-clients](sitebuildup-clients-2026-11-20.md); no template exists. |
| 28 | **Supplier partnerships and an affiliate route for the shop** | Worked out on paper in `commerce/COMMISSION.md`; no application sent. |
| 29 | **Multi-language / hreflang** | Not started, and not needed until there is a second language. |
| 30 | **Newsletter capture and a list** | No form, no list, no provider. |

## Changed since this list was written

- **The apex audit has been sent** to the project that runs sitebuildup.co.uk —
  revision `9b15569d`, 3,070 credits. Record:
  [anything-brief-sent-2026-11-20.md](anything-brief-sent-2026-11-20.md). Item 3
  (no prices) and item 4 (no proof) are what that revision is meant to fix; they
  stay on this list until the live site shows them fixed.
- **The Anything key works**, and the deployment can reach the API (items 14, 40,
  45 above).
- **The world snapshot says what it can do**: `/api/world` reports each bridge's
  read, its one write and the credits left, and answers a matching `If-None-Match`
  with a 304. See [atlas-world-2026-11-20.md](atlas-world-2026-11-20.md).

## How to read this list

Items 1–5 are the ones that make the difference between a demonstration and a
business. Items 14 and 15 are the ones that can surprise you, and `rate-limit-chat` is the
only one that can cost money while nobody is watching.

The Studio's **Standards** tab is the same list with the two best examples of each
line, scored against both sites, and it is the version that stays current.
