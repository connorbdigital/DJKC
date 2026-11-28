# The Anything brief — digital solutions agency (sitebuildup.co.uk)

Paste everything below the line into the Anything project, as a single prompt.
It is written for the agent, not for a reader: it assumes the project already
exists, names the files it will touch, and ends with checks the build has to pass.

Send it **before** the redesign, not after: items 1–6 are content and truth, and
they change what the design has to hold.

---

You are updating the existing website project that is published at
`sitebuildup.co.uk`. Do not rebuild it from scratch and do not change the visual
language — the dark, dense, editorial style is right. This prompt fixes what is
untrue, unindexable and unprovable, then adds the four pages a buyer looks for and
does not find.

Work in this order, and do not skip ahead: the later items assume the earlier ones
have landed.

## 1. One business, everywhere

- Trading name: **SiteBuildUp**. Legal entity, postal address, company number,
  VAT number and complaints route: read them from the site config (see item 2)
  and print the same block in the footer of every page, on `/contact`, and on
  `/privacy`, `/terms` and `/cookies`.
- One email: `hello@sitebuildup.com`. One phone: whatever the owner enters in the
  config. Delete every other address and number from the codebase — including
  `hello@digital-solutions.uk`, `hello@digitalsolutions.co.uk`,
  `privacy@yourcompany.com`, `legal@yourcompany.com`, `0203 627 4444` and
  `020 7946 0958`. That last one is in Ofcom's reserved drama range and can never
  be answered; it must not appear anywhere.
- Remove "London, United Kingdom" from `/about` unless the config holds a London
  address, and remove any other city that is not in the config.

## 2. One source of truth for the catalogue

- Create `src/data/business.ts` exporting `BUSINESS` (name, legal name, address,
  companyNumber, vat, email, phone, hours, complaintsEmail, jurisdiction) and
  `PRICING` (every service, every tier: id, name, service, price, priceUnit,
  delivery, features, vatIncluded).
- Every price on the site renders from `PRICING`: `/`, `/pricing`, `/services`,
  each `/services/*` page, the bundle maths, the OG/meta copy and the schema.
- **Resolve the conflicts now, with these values as the defaults** (the owner can
  edit the file afterwards): SEO Starter **£797/month**, SEO Growth **£1,497/month**,
  SEO Dominate **£2,997/month**; Starter Website **£995 one-off**, Professional
  Website **£2,495**, Enterprise Website **£5,995**; App Starter **£6,995**;
  AI Starter **£2,995**; E-Commerce Starter **£1,995**. Delete the £160/£240/£280
  retainers and the "from £795" hero line; the lowest advertised price becomes
  whatever `PRICING` says is lowest.
- All prices are **including VAT** for consumer-facing display. If the owner wants
  ex-VAT pricing, print "ex VAT" beside every price on the same line — never only
  in the terms.

## 3. Legal pages that are not templates

- Rewrite `/privacy`, `/terms`, `/cookies` against `BUSINESS`. No bracketed
  placeholders, no `yourcompany.com`, no `[Your Jurisdiction]`.
- Terms must state: what is delivered, delivery windows, payment schedule, the
  cancellation and refund policy, the guarantee (one guarantee, matching the
  site — either 30 days money-back or the 30–90 day warranty, not both), the
  liability cap, IP ownership on full payment, and England & Wales law.
- Cookies: remove "by using our website you consent". Add a consent step that runs
  **before** any non-essential script, listing each cookie by name, purpose and
  duration. If the site sets none, say so and drop the page's marketing-cookie
  section entirely.

## 4. Every route gets its own head

- Add per-route `title`, `description`, `canonical`, `og:title`, `og:description`,
  `og:image` — for `/`, `/services`, each of the 13 `/services/*` pages,
  `/pricing`, `/about`, `/contact`, `/book-consultation`, `/blog`, each post,
  `/privacy`, `/terms`, `/cookies`.
- Titles under 60 characters, written for a buyer, brand last. No page may reuse
  another page's title. The current single title — "SiteBuildUp | Website Design,
  Mobile Apps & AI Automation for UK Businesses — From £795" — is wrong on every
  route including the blog.
- Exactly one `<h1>` per page. Fix "Drive Traffic & BoostSales With SEO" to
  "SEO & Digital Marketing" and "Websites, apps &  AI that pays for itself." to
  one correctly spaced sentence.

## 5. Crawlers get the same site as people

- Generate `/robots.txt` (allow all; explicitly allow GPTBot, OAI-SearchBot,
  ClaudeBot, PerplexityBot, Google-Extended; reference the sitemap),
  `/sitemap.xml` from the route table, and `/llms.txt` with: who we are, what we
  sell with prices, the six service URLs, the contact block.
- Render the services, prices and FAQ as HTML in the initial response, not only
  after hydration. `/book-consultation` must show, without JavaScript: what the
  call is, how long it takes, what it costs (nothing), what happens after it, and
  the phone/email alternative.
- Schema: `LocalBusiness` (from `BUSINESS`) site-wide; `Service` + `Offer` with the
  real price on each service page; `FAQPage` on each service page; `Article` +
  `author` (a real person, with a bio page) and `datePublished`/`dateModified` on
  every post; `BreadcrumbList` on service and blog pages.

## 6. Truth in numbers

- Wire the homepage counters to real values from `BUSINESS.stats` and let them
  render their final number server-side. They currently display `0+`, `0%`, `0%`,
  `0+`.
- One claim per metric, site-wide: if it is 200 projects, it is 200 on `/`, on
  `/about` and in the schema. Delete the other totals ("750+", "500+", "312% ROI",
  "98%", "£2M+") unless the owner confirms them in `BUSINESS.stats`.
- Review counts: only publish a rating that links to the live profile (Google,
  Trustpilot, Clutch). No link, no number. Delete "4.9 / 127 reviews" until each
  one has a URL.
- Replace the three stock "success stories" on `/services/seo-marketing`
  (TechStart Solutions, Local Home Services, E-commerce Fashion) and the invented
  logo wall with entries from `src/data/work.ts`. If that file is empty, render an
  honest empty state — "case studies published soon, ask for references" — and
  link to `/contact`. Invented testimonials are illegal under the DMCC Act 2024.
- `/about`: remove the four team members with initials-only avatars unless each
  has a real photo and a LinkedIn URL, or replace the section with a single named
  founder and a photo.

## 7. Four missing pages

1. **`/work`** — case studies from `src/data/work.ts`: client, sector, what we
   built, live URL, one metric with its date and how it was measured, and a
   screenshot. Empty state must not pretend.
2. **`/faq`** — 15–20 real questions with answer-first paragraphs, grouped by
   service, each linking to the tier it concerns, with `FAQPage` schema.
3. **`/process`** — the eight steps from brief to launch with week numbers,
   what the client provides at each step, what happens if we are late, and the
   guarantee restated in policy language.
4. **`/contact`** — keep the form, add above it: one address block from
   `BUSINESS`, one phone number, the hours, a response-time promise, and a privacy
   line with a link to `/privacy` and a consent checkbox for marketing (unchecked
   by default).

## 8. Conversion details

- Home: put the real starting price and "free, 30 minutes, no obligation" next to
  the primary CTA; keep one primary CTA, not four.
- `/services`: replace the identical "24/7 Support · Fast Delivery · Premium
  Quality" strip on all 33 cards with one differentiating line per tier, and stop
  marking ten tiers "POPULAR" — one per service, at most.
- `/pricing`: state VAT, add "what is not included", and link each tier to the
  matching FAQ answer.
- Bundle builder: show the arithmetic (list total, discount, total) as it changes.
- Fix the copy defects: "Per per page", "Per each", "Per starting from", the tab
  labels leaking into body text ("All One-off Projects Monthly Plans").

## 9. Do not

- Do not invent a client, a review, a team member, an address or a metric.
- Do not introduce a second design system, a new font, or a new colour.
- Do not add a chat widget that answers from nowhere; if you add one, label it as
  a demo and drive it from the service catalogue.
- Do not change URLs that are already indexed; add redirects if a slug must move.

## 10. Acceptance — check these before you stop

1. `curl -s https://sitebuildup.co.uk/services | grep -c '<title>'` returns 1 per
   page and each page's title differs from every other page's.
2. `/robots.txt`, `/sitemap.xml` and `/llms.txt` return 200; the sitemap lists
   every route including all 13 service pages and every post.
3. Every price on `/`, `/pricing` and `/services` is identical for the same tier,
   and says whether it includes VAT.
4. `grep -R "yourcompany\|\[Your\|020 7946\|digital-solutions" src` returns
   nothing.
5. The homepage renders real counts with JavaScript disabled.
6. No page has two `<h1>`s, and no H1 contains a product name like "BoostSales".
7. Every review number on the site has a link to its live profile, or does not
   exist.
8. Rich Results Test passes with no errors on `/`, one service page, and one post.
