# sitebuildup.co.uk (apex) — full audit against our own services

**Subject:** `https://www.sitebuildup.co.uk` — the **agency** site. Not the DJKC
artist site on `kaysie.sitebuildup.co.uk`, which has its own audit.

**What this actually is:** a Node/Anything deployment serving a client-rendered
single-page app at the apex. The Open Graph image still carries the build's own
project path — `/bundle-link/digital-solutions-marketing-449/opengraph-image.png`
— which is where "digital solutions agency" comes from: this is that project,
published onto `sitebuildup.co.uk`.

**Tested live on 20 Nov 2026**, 15 URLs, read as a visitor and as a crawler:
`/`, `/services`, `/services/seo-marketing`, `/pricing`, `/about`, `/contact`,
`/book-consultation`, `/blog`, `/blog/seo-guide-uk-2026`, `/privacy`, `/terms`,
`/cookies`, plus `robots.txt`, `sitemap.xml` and `llms.txt` (all three absent).

**Overall: 34/100.** Not a broken site — a site selling six services while
demonstrating none of them. The SEO page publishes an eight-pillar checklist the
site itself fails on every pillar, with a section headed *"How This Site
Practices What It Preaches — check it yourself"*.

| Area | Score | One line |
| --- | --- | --- |
| On-page SEO | **2 / 10** | One `<title>` and one meta description for all 25+ routes; `BoostSales` in the H1 |
| Technical SEO | **2 / 10** | No `robots.txt`, no `sitemap.xml`, no `llms.txt`; content behind JS |
| AEO / GEO | **1 / 10** | Nothing for an answer engine to quote, and no single entity to attribute it to |
| Local SEO | **1 / 10** | No address; three phone numbers and three email domains |
| Content | **6 / 10** | The blog is genuinely good; no authors, stale since June, no internal links |
| Trust & compliance | **1 / 10** | Legal pages are unfilled templates with `[Your Business Address]` in them |
| Conversion | **5 / 10** | Clear offers and a fast path; contradicted prices, zero proof, invented reviews |
| Design | **6 / 10** | Modern dark UI, competent layout; counters render `0+`, tab labels leak into copy |
| **Match to the six services we sell** | **2 / 10** | The portfolio piece for SEO, design and automation does not pass its own products |
| **Universal functions** | **4 / 15 done** | 4 partial, 6 missing, 1 not needed |

---

## 1. What I tested, and what I could not

Tested by reading every page above as rendered, and by asking for the three files
a crawler reads first.

**Could not verify, and will not pretend otherwise:** HTTP status codes and
redirect chains (no network access from this environment to the apex — only the
rendered page through a reader), Core Web Vitals / LCP, actual `<title>` per
route as served *before* JS executes (the reader receives post-JS titles, which
is why the repetition is the finding), structured data in the HTML source,
whether Google Analytics or the cookie banner fires, Search Console coverage,
and backlink profile. Each of those is one line in §5 to confirm with the site's
own tools.

## 2. Findings, worst first

### A. Three businesses, one site (and one number that does not exist)

| Page | Email | Phone | Location |
| --- | --- | --- | --- |
| `/contact` | `hello@sitebuildup.com` | +44 (0) 7842 630 368 | — |
| `/services` | `hello@digital-solutions.uk` | 0203 627 4444 | — |
| `/about` | `hello@digitalsolutions.co.uk` | +44 20 7946 0958 | London, United Kingdom |
| `/privacy`, `/terms`, `/cookies` | `privacy@yourcompany.com`, `legal@yourcompany.com` | `[Your Phone Number]` | `[Your Business Address]` |

Three different domains, two different 0203 numbers and a mobile, and one of them
— **020 7946 0958** — is inside Ofcom's reserved range for drama, i.e. it is
guaranteed never to be answered. For a business whose entire promise is
"transparent", this is the single most expensive thing on the site: a buyer who
notices it stops believing every number on every other page. It is also an
entity problem for search: Google cannot decide whether this is SiteBuildUp,
Digital Solutions or digitalsolutions.co.uk, so it trusts none of them.

### B. The legal pages are templates, published

`/privacy`, `/terms` and `/cookies` are all "Last updated: January 15, 2026" and
still contain the blank fields:

- `privacy@yourcompany.com`, `legal@yourcompany.com`
- `[Your Business Address]`, `[Your Phone Number]`
- "governed by … the laws of `[Your Jurisdiction]`"

What that means in the UK, concretely:

- **No trader identity** before payment: the Consumer Contracts Regulations 2013
  require a trader's geographical address and a complaints route *before* a
  consumer is bound. A template is not that.
- **Cookie consent is pre-2011 wording** — "By using our website, you consent to
  our use of cookies", while the same page lists marketing, retargeting and
  third-party advertising cookies. PECR wants prior consent for anything that is
  not strictly necessary, served *before* the cookie is set.
- **Terms disclaim their own prices**: "All prices are exclusive of applicable
  taxes". Meanwhile the homepage advertises "Fixed prices from £795" and every
  card reads "one-off". A consumer-facing price that excludes VAT is a misleading
  action under the CPRs; a business price must say "ex VAT" where the price is
  shown, not in clause 5 of the terms.
- **"30–90 days warranty on technical functionality"** in the terms versus
  "30-Day Money-Back Guarantee … no questions asked" on the homepage and "100%
  guarantee" on the SEO page. Three different promises.

### C. Four price lists, and the same tier at four prices

| Tier name | `/services` | `/pricing` | `/services/seo-marketing` | Home |
| --- | --- | --- | --- | --- |
| SEO Starter | £160/mo | £797/mo | £797/mo | "from £499" |
| SEO Growth | £240/mo (Ads) | £1,497/mo | £1.5k/mo | — |
| Website — starter | £795 | £995 | — | "from £795" / "from £995" |
| Mobile app — entry | £1,595 (add-on) | £6,995 | — | "from £3,995" |
| AI — entry | £315 (chatbot) | £2,995 | — | "from £1,495" |

The same named retainer is **£160 or £797 a month** depending on which page you
land on. Add the bundle discounts (10% / 15% / 25%), the "25% bundle savings"
badge, the "Save up to 30%" bundle builder and the "25% Enterprise" line, and no
two pages agree on what anything costs. That is not a pricing strategy; it is
four generators writing four versions of the same page.

### D. The SEO page fails the SEO checklist it publishes

`/blog/seo-guide-uk-2026` ends with a section titled *"How This Site Practices
What It Preaches — check it yourself"* listing six claims. Checked:

| Claim on the post | Reality |
| --- | --- |
| "robots.txt at /robots.txt — welcoming crawlers" | `/robots.txt` does not resolve |
| "sitemap.xml at /sitemap.xml — every page and post listed" | `/sitemap.xml` does not resolve |
| "llms.txt at /llms.txt — structured summary for AI search engines" | `/llms.txt` does not resolve |
| "Article schema on every blog post — author and publish date" | No author anywhere on the post; every route ships the same document title |
| "LocalBusiness schema with address, hours and rating in the footer" | There is no address in the footer, and three different ones elsewhere |
| "Keyword-targeted titles on every page" | One title for every page: *"SiteBuildUp \| Website Design, Mobile Apps & AI Automation for UK Businesses — From £795"* |

The same page tells the reader to put the keyword in the title tag, the meta
description, the H1, the first 100 words and one H2 — the site does it on zero
pages, because a client-rendered SPA with a single document title cannot.

### E. Proof is stock photography and invented people

- Success stories on `/services/seo-marketing`: **TechStart Solutions**, **Local
  Home Services**, **E-commerce Fashion**, each illustrated with an Unsplash
  photo, each with a quote attributed to a named person ("Sarah Mitchell, Head of
  Marketing", "Mike Johnson, Owner", "Emma Chen, E-commerce Manager") and results
  like "£2.3M additional revenue in 12 months". No link, no logo, no date, no
  permission.
- Logo wall and testimonial carousel: EcoCommerce, MedConnect, FinanceFlow,
  StyleHub, LogiTrack, PropertyPro, TechStart, BuildRight, GreenLeaf Co, Apex
  Fitness, NovaSoft, BrightDental, Swift Legal, Urban Eats, CloudFlow. Generic
  compounds, no sites to visit.
- Ratings: "Google 4.9 — 127 reviews", "Trustpilot 4.8 — 89", "Clutch 5 — 43",
  and "5.0 Rating / 98% / 500+" on the SEO page. None links to a profile.
- `/about` team: James Mitchell, Sarah Thompson, David Chen, Emily Roberts —
  initials in a circle, no photo, no LinkedIn, no work.
- Counters on the homepage render **`0+` / `0%` / `0%` / `0+`** above the fold,
  with the copy beside them claiming 750+ projects and 312% ROI. A counter that
  never started is a worse advert than no counter.

Fabricated social proof is not a grey area in the UK: the DMCC Act 2024 makes
fake reviews and invented testimonials expressly illegal, with CMA direct
enforcement. This is the second most expensive thing on the site.

### F. Conversion and copy defects a visitor sees

- H1 on `/services/seo-marketing`: **"Drive Traffic & BoostSales With SEO"** —
  missing space, product name artefact.
- Homepage H1: "Websites, apps &  AI that pays for itself." — double space.
- `/pricing` and `/services` leak tab labels into the body copy: "All One-off
  Projects Monthly Plans", "Per per page", "Per each", "Per starting from".
- Every one of the 33 service cards carries the identical sales strip — "24/7
  Support · Fast Delivery · Premium Quality" — while `/contact` and `/about` say
  Mon–Fri 9–6. Ten cards claim "POPULAR" in the same list; three tiers on
  `/pricing` are "Most Popular".
- `/book-consultation`: step 1 of 4, service picker only. No price, no duration
  honesty (it prints "45 min" next to each service), no obligation statement, no
  phone alternative, no email fallback. A crawler sees a form with no context.
- `/contact`: name, email, budget band, date, time — no privacy line, no consent
  box, no response promise, and the budget question arrives before any value.
- Blog: 17 posts, all dated 15 Jan – 8 Jun 2026 (nothing for five months), no
  author, one CTA at the end and no internal links to the service pages they
  argue for. One slug still says `-2025` on a 2026 post.

### G. What is genuinely good (so the fix list is not read as demolition)

- The **blog content itself** is better than most UK agencies publish: specific,
  structured, opinionated, with real target numbers ("LCP under 2.5s", "title
  tag 50–60 characters"). It reads like someone who can do the work.
- The **service catalogue** is unusually complete: 13 services, 33 tiers, delivery
  windows, feature lists. Most competitors have a contact form.
- The **bundle builder** (2 services 10%, 3+ 15%, enterprise 25%) is a genuinely
  good commercial idea that almost no competitor offers at this price point.
- The **command palette** (⌘K) and the dark, dense visual language are a cut above
  template agencies.
- Clean URLs, HTTPS, sensible information architecture: the skeleton is right.

## 3. The 15 universal functions, matched

| Function | Status | Evidence |
| --- | --- | --- |
| Navigation | **Done** | Persistent header, ⌘K palette, `/services` catalogue |
| Home | **Done** | Offer, price anchor, CTA, logo wall — but broken counters |
| Pricing | **Partial** | Four sources that disagree; no VAT statement on the page |
| Booking | **Partial** | 4-step wizard, no confirmation content, no fallback |
| Questions | **Missing** | No FAQ anywhere, no `FAQPage`, no "what happens next" |
| About | **Partial** | Named team with no faces, three identities, no history |
| Availability | **Missing** | No calendar, no next-start-date, no capacity signal |
| Work | **Missing** | No portfolio, no case-study pages, no live URLs |
| Coverage | **Missing** | No service areas, no "we work with UK businesses remotely" statement |
| Proof | **Missing** | Stock photos, invented quotes, unlinked review counts |
| Legal | **Partial** | Pages exist, all three are unfilled templates |
| Journal | **Done** | 17 real posts — no authors, stale since June |
| Account | **Not needed** | Nothing to log into |
| Search | **Done** | ⌘K palette |
| Sitemap | **Missing** | No `sitemap.xml`, no `robots.txt`, no `llms.txt` |

**4 done · 4 partial · 6 missing · 1 not needed.** Compare: the artist site on
the kaysie subdomain is 11 done after the 20 Nov pass, on a tenth of the budget.

## 4. What each area should have — the standard we sell

The test of an agency site is not "does it look good". It is: **could a client
audit us with our own product?** Five instruments, applied to ourselves.

**SEO & marketing** — one `<title>` per route, written for a buyer, under 60
characters; a `robots.txt` that names GPTBot, ClaudeBot, PerplexityBot and
OAI-SearchBot; an XML sitemap referenced from robots; canonicals; one H1 per page
containing the keyword, no product-name artefacts; Article schema with a real
author on every post; `LocalBusiness` with the *same* address the footer prints;
`FAQPage` on every service page; internal links from each post to the tier it
sells. **Standard to hit: the eight pillars on our own page, 8/8.**

**Website design** — real work, shown: 6–12 live sites with before/after metrics
and the client's own domain; a process page with week-by-week delivery and what
happens if we are late; performance budget published (LCP < 2.0s, < 200kB JS on
the marketing routes). Stock photography only where it is honest to use it, never
as a case study. **Standard: a visitor can open three sites we built.**

**Content** — 30+ posts with named authors and a bio line, refreshed quarterly,
each mapped to one commercial page, each with a dated "last reviewed" and at least
three internal links. **Standard: every post answers the question it ranks for and
proves it with a number we would defend.**

**E-commerce** — a merchandised list with prices including VAT, stock/lead time on
the card, a checkout that states delivery cost before payment, and a returns page.
**Standard: the shop can be bought from in under 60 seconds on a phone.**

**AI automation** — one live demo of the thing we sell: a chatbot on our own site,
answering from our own content, with a visible "this is the demo" label and a
transcript. **Standard: the product is on the site, not described on the site.**

**Business automation** — the boring proof that convinces: a booking flow that
writes to a CRM, sends the confirmation, and lands in a pipeline the client can
see; a cancellation policy the system enforces. **Standard: we can show the flow
diagram and the record it produced.**

## 5. Action plan, in order of return

**Today (hours). Fix the four things that cost money:**

1. **One identity.** Pick the legal name and one email domain. Put the trading
   name, the postal address, the company number, one phone number, one email and
   the complaints route in the footer of every page and in `/contact`, `/privacy`,
   `/terms`, `/cookies`. Delete the fictional 020 7946 0958 and the two spare
   domains.
2. **Finish the legal pages.** Replace `[Your Business Address]`, `[Your
   Jurisdiction]`, `yourcompany.com`; add VAT to every advertised price (or say
   "ex VAT" where the price is shown); replace the consent-by-browsing sentence
   with a real consent step before non-essential cookies.
3. **One price list.** One source of truth rendered everywhere: `/pricing`,
   `/services`, the service pages, the bundle maths and the OG copy read it. Kill
   the £160 SEO retainer or the £797 one — not both.
4. **Stop the counters at a real number.** If there are 200 projects, print 200.
   If there are 40, print 40. A wrong number is worse than a small one.

**This week (days). Make it rankable:**

5. Per-route `<title>`, description, canonical and OG in the router; one H1 per
   page; kill `BoostSales`, the double space, and the leaked tab labels.
6. `robots.txt`, `sitemap.xml` and `llms.txt` generated from the route table —
   then update the blog post's "check it yourself" section to the truth.
7. `Article` + `author` on posts, `LocalBusiness` + `FAQPage` on service pages,
   `Service` + `Offer` with the real price on each tier.
8. Replace the three stock "success stories" with three real ones, or delete the
   section. Same for the invented logo wall and the unlinked review counts.

**This fortnight:**

9. A work page: six live sites, each with a URL, a screenshot of the thing we
   built, and one number that changed.
10. A proof page: the real review profile links, three written references with
    names and roles, and the press/partners list with dates.
11. A process page with delivery windows and the 30-day guarantee written as a
    policy (what it covers, how to claim), matching the terms.
12. An AI demo on the site: chatbot trained on the catalogue, labelled as a demo,
    with a transcript and a "book the real thing" hand-off.

**This quarter:**

13. A journal cadence with named authors and quarterly refresh; 30 posts mapped to
    the 13 services.
14. Local SEO properly: one address, one Google Business Profile, consistent NAP,
    location pages only where there is a real presence.
15. Performance budget enforced in CI on the marketing routes, published on the
    process page.

## 6. The prompt

The ready-to-paste brief for the Anything project is in
`docs/anything-prompt-digital-solutions-agency.md`, and in the Studio's Anything
tab behind *Send the audit to a project*.

## 7. What I could not do, and why

**I could not reach the Anything project from this environment.** Three separate
walls, none of them guesswork:

1. The sandbox has outbound access to GitHub, npm and PyPI only —
   `api.anything.com` times out; the same restriction that stopped me reading the
   apex over `curl`.
2. `ANYTHING_API_KEY` in the Studio project is stored as a **sensitive** Vercel
   variable: the API returns `value: null` on read, by design. I cannot read the
   key, so I cannot call Anything myself.
3. The Studio deployment — the one place where the key does exist — is behind
   Vercel deployment protection; `/api/anything` answers with the Vercel login.
   There is no unauthenticated path to it, and I would not create one.

So the edit is a click you make, not a call I make: the bridge now supports
`POST /v0/api/projects/{id}/generate` for a single well-formed project id, the
Studio's Anything tab has the brief loaded, and the key still never touches the
browser. Everything except that final click is done and tested here.
