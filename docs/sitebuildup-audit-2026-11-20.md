# sitebuildup — full diagnosis and audit

**Subject:** `kaysie.sitebuildup.co.uk` (the real SiteBuildup site: DJ KC — house DJ,
live vocalist, producer, North West), and the apex `sitebuildup.co.uk`, which is a
different business on the same name.

**Tested live on 20 Nov 2026** by reading the site as a public visitor and as a
crawler: the homepage, `/prices.html`, `/how-much-does-a-dj-cost.html`, `/faq.html`,
`/services…` on the apex, `/book-consultation`, `/contact`, `/blog`, plus
`robots.txt`, `sitemap.xml`, `llms.txt` and the apex's service pages.

**Overall: 68/100.** Good bones — better AEO hygiene than most agencies sell — and
four missing functions plus one trust problem holding it back.

| Area | Score | One line |
| --- | --- | --- |
| On-page SEO | **8 / 10** | Unique titles, answer-first copy, clean URLs, real internal links |
| Technical SEO | **7 / 10** | robots + sitemap + llms.txt present; structured data unverified, no canonicals/404 evidence |
| AEO / GEO | **8 / 10** | AI crawlers explicitly allowed, `llms.txt` with canonical facts, FAQ + cost guide |
| Local SEO | **5 / 10** | Coverage page exists; no address, no NAP, no Google Business Profile link, artist on a subdomain |
| Content depth | **6 / 10** | 16 pages, strong occasion cluster; no journal, no case studies, no video |
| Trust & compliance | **4 / 10** | No terms, no privacy page, no trader identity — while taking Stripe deposits |
| Conversion | **8 / 10** | Prices on the page, budget suggestion, deposit, calendar downloads, 24h reply promise |
| **Universal functions** | **9 / 15 done** | 2 partial, 4 missing (work, proofs, legal, journal) |

---

## 1. What I actually tested — and what I could not

Read in full: home, prices, cost guide, FAQ (4 of the 16 URLs in the sitemap),
plus robots, sitemap and llms.txt on the artist site; home, `/services`,
`/services/website-design`, `/services/seo-marketing`, `/book-consultation`,
`/contact` and `/blog` on the apex.

**Not verifiable from here — do these yourself in five minutes:**

| Check | How | Why it matters |
| --- | --- | --- |
| JSON-LD / schema | `view-source:` each page, or Rich Results Test / Schema Markup Validator | The single biggest unclaimed SEO win if it is missing |
| Canonical tags | `view-source` → `<link rel="canonical">` | Subdomain → apex → `djkcmusic.com` is exactly where duplicates appear |
| Core Web Vitals | PageSpeed Insights on the live URL, mobile | Demo deck + video posters are the likely cost |
| Indexation | `site:kaysie.sitebuildup.co.uk` in Google, Search Console coverage | sitemap existing is not the same as indexed |
| The deposit | Complete one real booking in test mode | The FAQ promises a 50% Stripe deposit; that claim must be true |
| AI citations | Ask ChatGPT/Perplexity "who is a house DJ with live vocals in Manchester" | The only real AEO test that counts |

---

## 2. Findings, worst first

### A. Trust and compliance (the blocker)

1. **No terms, no privacy policy, no trader identity.** The sitemap has 16 URLs;
   none is `/terms`, `/privacy`, `/cookies`, `/contact` or an about-the-business
   page with a company name, number or address. The site takes card deposits
   through Stripe. Under UK consumer law a trader selling online must identify
   itself (name, geographic address, contact) and set out cancellation/refund
   terms and a privacy notice before payment. This is the first thing a careful
   buyer, a lawyer, or an AI answer engine checking "is this a real business"
   looks for — and it is missing.
2. **The email domain does not match the site.** Bookings go to
   `booking@djkcmusic.com` while the site is on `kaysie.sitebuildup.co.uk`. Two
   brands, one artist. An answer engine resolving the entity sees a mismatch.
3. **Unsourced performance numbers.** "1102+ club shows", "2295K streams",
   "900% promoters rebook", "37 residencies", "▲ +38% avg. bar spend". Some may be
   true; none is sourced or linked. Written as they are — and note the stray
   minus signs the counters expose to a text-only reader — they read as invented,
   and unsourced claims are discounted by both buyers and answer engines.
4. **The apex is a different, self-contradicting business.** `sitebuildup.co.uk`
   sells agency services with claims that do not survive a single read: "From
   £795" in the hero, "From £995" in the services grid, "£2,997" in the FAQ,
   £799/£1,999 monthly tiers, "ISO 27001 Certified", "Award Winner 2024",
   "500+ happy clients" under a logo wall of invented brands (EcoCommerce,
   MedConnect, TechStart), three "success stories" with Unsplash stock photos and
   a named testimonial (Sarah Mitchell) who is "Head of Marketing" on one page
   and "CEO" on another. The footer address in the crawled version still says
   **"Tech Innovate HQ, Manchester, M1 1AA"** — a template leftover. Fake reviews
   are illegal in the UK since the 2023 DMCC Act; template leftovers and invented
   logos are the kind of thing that ends up in a screenshot on someone's feed.

**Fix:** privacy, terms, company details in the footer of every page; put the
artist site on `djkcmusic.com` with 301s and make the apex one honest business
page; delete or source every number.

### B. SEO

5. **No journal.** `/how-much-does-a-dj-cost.html` is a genuinely good pillar
   page — answer-first, a comparison table, "what changes the price", internal
   links to prices, weddings and Manchester. It is also the *only* informational
   page. Sixteen pages and one guide is a service site, not a topical authority;
   "wedding DJ questions", "first dance songs", "how long should a DJ play",
   "DJ vs band" are all one page each and all currently unowned.
6. **Local SEO is half-built.** The coverage page and the Manchester page are
   good copy. But there is no NAP block (name, address, phone) anywhere, no link
   to a Google Business Profile, no map, no address at all, and the artist lives
   on a subdomain of someone else's brand. "DJ hire Manchester" is a map-pack
   query; without a profile and a location this site cannot appear in it.
7. **One content bug with real AEO cost.** The FAQ asks **"How far in advance
   should we book?" twice**, with two different answers (6–10 weeks vs four to
   five months / 6–12 for peak Saturdays). An answer engine picks one; a reader
   notices. Delete one.
8. **Structured data unverified** (see §1). If it is absent, this is the fastest
   win on the site: `Person`/`MusicGroup` + `Offer` (the two prices) on home and
   prices, `FAQPage` on the FAQ, `Service` on each occasion page, `Event` on each
   live date (with venue, city, ticket URL), `BreadcrumbList` everywhere.

### C. AEO / GEO — the strongest part of the site

9. **Better than most.** `robots.txt` explicitly allows `GPTBot`,
   `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`,
   `Google-Extended` and `CCBot`, and points at the sitemap. `llms.txt` exists
   and is excellent: a canonical one-sentence description, the facts (prices,
   kit, areas, notice periods), stated limitations ("one artist, cannot play two
   rooms at once"), a page index and social links. Almost nobody in this market
   has this.
10. **What is still missing for answers:** no citable *data* (a table of real
    past show counts by year, a price band table with sources — the cost guide
    says "published averages" but cites none), no reviews to quote, and no
    `FAQPage` schema to make the FAQ machine-readable. Answers engines quote
    pages that state a fact and show where it came from.
11. **Measure it.** Nothing shows whether AI referrals happen. Add
    `perplexity.ai`, `chatgpt.com`, `claude.ai`, `copilot.microsoft.com` as
    referral sources in analytics — a UTM-less referrer report is enough.

### D. Conversion

12. Strong: prices on the page, "suggest your own budget", 50% deposit via
    Stripe, calendar downloads per date, a booking brief PDF, a 24-hour reply
    promise, a demo deck. Two gaps: there is **no dedicated `/book` page** (the
    form is a `#book` anchor on a very long homepage — hard to link to, and the
    sitemap's most important conversion URL is invisible to search), and no
    **proof** section with real, verifiable reviews.

---

## 3. The Universal audit — every function a site should have

The Studio's inventory (15 functions). "Done" means a page or section a visitor
can reach; "partial" means it exists but is weaker than the market expects.

| Function | Status | Where it is / what is missing |
| --- | --- | --- |
| Navigation | **Done** | Header nav on every page |
| Home | **Done** | `/` — hero, occasions, demo deck, shows, booking |
| Pricing | **Done** | `/prices.html` + cost guide; consistent £650 / £1,100 / quoted |
| Booking | **Partial** | `#book` form with Stripe deposit claims; no `/book` page, no terms |
| Questions | **Done** | `/faq.html` — answer-first, 17 questions (one duplicated) |
| About | **Done** | `/about.html` |
| Availability | **Done** | `/shows.html` + `/api/calendar` iCal feed — rare and good |
| Work | **Missing** | No case studies, no gallery of real nights, no venue list with dates played |
| Coverage | **Done** | `/coverage.html` + Manchester page |
| Proof | **Missing** | No reviews page, no Google/Trustpilot link, no press quotes with sources |
| Legal | **Missing** | No terms, privacy, cookies, company details |
| Journal | **Missing** | One cost guide; no guide hub, no articles |
| Account | **Not needed** | Single-artist bookings; contracts by email is fine |
| Search | **Missing** | No site search (minor at 16 pages, matters at 30) |
| Sitemap | **Done** | `sitemap.xml`, referenced from robots |

**Score: 9 done, 2 partial, 4 missing** → 60% of the universal set, and the four
missing ones are the four that carry trust and growth (work, proof, legal, journal).

---

## 4. What it should have, in order

**This week (hours, not days)**

1. Fix the duplicated FAQ question.
2. Add `FAQPage` schema to the FAQ, `Person`/`MusicGroup` + `Offer` to home and
   prices, `Service` to the seven occasion pages, `Event` to each live date.
3. Add a footer block to every page: DJ KC, trading name and company details,
   `booking@djkcmusic.com`, phone, links to Terms, Privacy, `llms.txt`.
4. Write the two missing legal pages (terms + privacy, including what the booking
   form collects and that Stripe processes the card).
5. Add a real `/book` page that hosts the form, and point every CTA at it.

**Next two weeks**

6. A **proof** page: verified reviews (Google Business Profile linked, Trustpilot
   if real), three venue quotes with names, and the press/venue list already on
   the homepage with dates attached.
7. A **work** page: six nights, each with venue, date, crowd size, one photo and
   one line on what KC did. Photos of real rooms beat any statistic.
8. **Local SEO**: Google Business Profile, NAP block on the site matching it
   exactly, a map, and Liverpool / Preston / Chester pages built on the
   Manchester pattern (she plays 24 Kitchen Street — Liverpool is a real claim,
   "DJ hire Liverpool" is a real query).

**Next month**

9. **Journal**: launch with the six questions people actually ask — how to choose
   a wedding DJ, first dance choices, how long a DJ should play, DJ vs band vs
   singer-DJ, what a DJ needs from a venue, how far ahead to book. Each one links
   to the cost guide and to the relevant occasion page.
10. **Move to `djkcmusic.com`** — it matches the email and every music platform —
    and 301 the subdomain. Then decide what `sitebuildup.co.uk` is: one honest
    business, or the artist's host.
11. **Fix or delete the apex's claims.** Contradictory prices (795/995/2,997),
    invented logos and stock-photo case studies are a liability, not marketing.
12. **Measure**: Search Console, PageSpeed, and AI referral sources in analytics.

---

## 5. The short version

The artist site is genuinely well built: unique titles, answer-first pages, real
prices, a sitemap, `llms.txt`, AI crawlers allowed, an iCal feed and a demo deck.
It is better at AEO than most agencies in this market — which makes the gaps
glaring by contrast: **no legal pages, no trader identity, no proofs, no work, no
journal, and an apex domain that contradicts its own prices.** Fix the four
missing functions and the trust block, and this goes from a good site to one that
can win "DJ hire Manchester" on evidence rather than adjectives.
