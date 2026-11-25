# Everything suggested that is not done yet

*2026-11-20. An inventory, not an apology: what has been raised in this project and
still is not true. Ordered by what it costs to leave undone.*

## Blocks a sale, or the law

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 1 | **Shop checkout** | Hearth & Grain has a catalogue, a basket and no payment step. Nothing can be bought. | M |
| 2 | **Privacy notice, terms of sale, cookies, accessibility statement** | None exist on either site, and both collect names and emails. | S |
| 3 | **SiteBuildup has no prices** | Competitors publish ranges; "contact for a quote" reads as expensive. Packages are drafted in [sitebuildup-clients](sitebuildup-clients-2026-11-20.md), not published. | S |
| 4 | **No proof of work anywhere** | No case study, no testimonial, no number. Both sites describe; neither demonstrates. | M |
| 5 | **Google Business Profile** | Not claimed, so a local search finds nothing. | S |

## The shop

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 6 | **A real supplier account** | `commerce/SUPPLIERS.md` documents ten feeds; the catalogue is invented. No trade account, no sample order. | M |
| 7 | **Real product photography** | 33 generated SVG placeholders, honest but not sellable. | M |
| 8 | **Order confirmation and dispatch email** | Blocked on checkout. | S |
| 9 | **Analytics with consent, and four named events** | Nothing measured on either site. | S |
| 10 | **Shipping rules applied in the basket** | "Free over £40" is stated and not enforced. | S |
| 11 | **Stock from a feed, not a column** | Stock is a CSV column, checked at build; nothing syncs it. | M |
| 12 | **Custom 404, installable shop (manifest), Core Web Vitals** | None. | S each |
| 13 | **A nicer domain than `ecommerce-two-psi-13.vercel.app`** | The Vercel project name was taken; add a domain and change one constant. | S |

## The Studio and the Atlas

| # | What | Where it stands | Effort |
| --- | --- | --- | --- |
| 14 | **Anything projects, verified live** | The bridge now explains a failure and answers a GET about itself; the last report was a bare 500, so the next message is the diagnosis. | S |
| 15 | **Rate-limit `/api/chat`** | An unauthenticated endpoint that spends money. The one item that can cost you overnight. | S |
| 16 | **The Agent's key on previews** | `ANTHROPIC_API_KEY` is production-only, so the Agent refuses on a preview deployment. | S |
| 17 | **Orrery and Constellation looks** | City, Blueprint, Observatory and Nebula ship; the other two directions from the earlier list do not. | M each |
| 18 | **Real-device testing** | Everything is checked in headless Chromium at 390 and 1500 wide. No iPhone, no Android, no Safari. | S |
| 19 | **WebXR with a headset** | "No headset" is the honest state of the VR button in this environment. | — |
| 20 | **A deploys tab, server-side projects, the physical-device todo** | Still open on the shelf, as they were before this week. | M |
| 21 | **Search synonyms and typo tolerance** | Site search matches substrings and nothing else. | S |

## Bigger things said out loud, still only said

| # | What | Where it stands |
| --- | --- | --- |
| 22 | **A pitch sheet generated from an audit** | The Studio can audit a URL; it cannot yet produce the one-page PDF that goes with it. |
| 23 | **A package builder** | Four offers are priced by hand in a doc. |
| 24 | **Case-study templates with metric fields** | Described in [sitebuildup-clients](sitebuildup-clients-2026-11-20.md); no template exists. |
| 25 | **Supplier partnerships and an affiliate route for the shop** | Worked out on paper in `commerce/COMMISSION.md`; no application sent. |
| 26 | **Multi-language / hreflang** | Not started, and not needed until there is a second language. |
| 27 | **Newsletter capture and a list** | No form, no list, no provider. |

## How to read this list

Items 1–5 are the ones that make the difference between a demonstration and a
business. Items 14 and 15 are the ones that can surprise you, and `rate-limit-chat` is the
only one that can cost money while nobody is watching.

The Studio's **Standards** tab is the same list with the two best examples of each
line, scored against both sites, and it is the version that stays current.
