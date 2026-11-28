# The process catalogue

13 processes on 7 shelves, and 8 steps the builder itself runs. Each entry says what it does, why the site needs it, and what specifically breaks without it.

Generated from `studio/src/features.ts` — run `npm run processes` after changing the library.

## Contents

- [Bookings & enquiries](#bookings-enquiries) — 2 processes
- [Running the desk](#running-the-desk) — 4 processes
- [Marketing](#marketing) — 1 process
- [Store & catalogue](#store-catalogue) — 2 processes
- [Design & conversion](#design-conversion) — 2 processes
- [Search & AI answers](#search-ai-answers) — 1 process
- [Data & storage](#data-storage) — 1 process
- [How the builder works](#how-the-builder-works) — 8 steps
- [Dependencies](#dependencies)

## Bookings & enquiries

_This is the shelf that makes money: the form, the deposit, the answers that stop people leaving. Everything else exists to feed it or to run what it produces._

### Booking form with Stripe deposits

**What it does.** A priced enquiry form: package selection, suggested budget, deposit or pay-in-full choice, Stripe Checkout, and a verified confirmation on return.

**Why the site needs it.** This is the only place on the site where money moves, and everything else points at it. A priced form plus a deposit turns a vague enquiry into a held date: people who pay something turn up, and the price is agreed before the first message.

**What breaks without it.** Enquiries arrive as unstructured texts and DMs, two people can hold the same Saturday, and the price gets negotiated twice. Nothing records what was quoted.

- Version: 1.0.1 · source: `connorbdigital/DJKC`
- Files: `api/bookings.ts` (needs editing), `api/deposit.ts`, `src/components/Booking.tsx` (needs editing), `src/components/Reveal.tsx`, `src/components/Icons.tsx`, `src/utils/dates.ts`, `src/data.ts` (needs editing)
- Environment: `STRIPE_SECRET_KEY`, `STRIPE_DEPOSIT_PERCENT`, `SITE_URL`
- Install after: storage-kv
- By hand: Replace the tiers and prices in the copied data file with this project's own; Point the copy at your booking address and social links; Decide the deposit percentage, or leave it at 50

### Booking chat

**What it does.** A themed chat panel that answers booking questions and hands off to the enquiry form, with a serverless endpoint that rates-limits and fails safe.

**Why the site needs it.** Most pre-booking questions are the same dozen: deposit, travel, what is included. Answering them inside the page keeps people from leaving to ask in a DM, where the answer is neither searchable nor saved.

**What breaks without it.** The same questions arrive by hand every week, and anyone who will not fill in a form leaves without asking at all.

- Version: 1.1.0 · source: `connorbdigital/DJKC`
- Files: `api/chat.ts`, `src/rateLimit.ts`, `src/components/BookingChat.tsx` (needs editing), `src/bookingGuide.ts` (needs editing), `src/components/Logo.tsx` (needs editing), `src/components/Icons.tsx`
- Environment: `CHAT_TOKEN`, `OPENAI_API_KEY`
- By hand: Rewrite the answer set for this project; Set the allowance to what one conversation costs you — twenty a minute is this project's guess

## Running the desk

_A booking that is not run becomes a complaint. These are the processes that keep the diary true after the enquiry lands._

### Token-gated admin desk

**What it does.** A private single-page desk for requests and sign-ups: unlock with a token, search, change status, export CSV, manage blocked dates.

**Why the site needs it.** Bookings are a job after the enquiry lands: quoting, confirming, blocking a date, deleting someone who asks. The desk is where that happens without a database console.

**What breaks without it.** Records can only be read by whoever holds the KV token. Nobody can change a status or honour a deletion request, and an erasure request becomes a manual job with a deadline.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `public/admin.html` (needs editing), `api/store.ts`
- Environment: `ADMIN_TOKEN`
- Install after: storage-kv
- By hand: Change the endpoints the page calls to match your own routes; Set ADMIN_TOKEN to a long random string

### Blocked dates

**What it does.** Block holidays and holds so the public availability check steers enquiries elsewhere, managed from the desk.

**Why the site needs it.** Availability is the one fact people check before they enquire. Blocking holidays is what keeps that check honest.

**What breaks without it.** The site invites enquiries for dates the owner cannot work. A wrong yes is worse than a slow one: it has to be taken back.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `api/blocked.ts`, `api/availability.ts` (needs editing)
- Install after: storage-kv, booking-form-deposits
- By hand: Add the Blocked dates tab to your desk

### Email notifications

**What it does.** Emails the desk when an enquiry lands, with reply-to set to the enquirer. Never blocks storage if mail fails.

**Why the site needs it.** An enquiry is only worth having if it is seen while the person is still interested. Email is the alert that does not depend on anyone opening a dashboard.

**What breaks without it.** Requests sit in storage until someone remembers to look. By then the enquirer has usually booked elsewhere.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `api/notify.ts`
- Environment: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`
- Install after: booking-form-deposits
- By hand: Verify the sending domain in Resend

### Public calendar feed

**What it does.** A read-only iCalendar feed of upcoming dates, so the owner can subscribe to their own gig list.

**Why the site needs it.** One subscription keeps the owner's own phone calendar in step with what the site publishes, so dates are entered once.

**What breaks without it.** Dates live in two places and drift apart. The site advertises a date that has already moved, which is the fastest way to lose trust.

- Version: 1.0.1 · source: `connorbdigital/DJKC`
- Files: `api/calendar.ts` (needs editing)
- By hand: Point it at your own dates source

## Marketing

_Getting one booking is expensive; getting the second from the same person is nearly free. This shelf is how the site earns a second visit._

### Database-backed mailing list

**What it does.** Subscribe endpoint with validation and rate limiting, a read/export/delete endpoint for the desk, and a delayed sign-up card for the site.

**Why the site needs it.** Repeat customers are a small share of buyers but a large share of revenue — around a fifth of buyers producing well over a third of sales in the studies behind this library. The list is the cheapest second booking there is.

**What breaks without it.** The site takes a booking and then loses the relationship. The only way back to that person is paid advertising, or hoping they remember the URL.

- Version: 1.0.1 · source: `connorbdigital/DJKC`
- Files: `api/subscribe.ts`, `api/subscribers.ts`, `src/components/UpdatesSignup.tsx` (needs editing), `src/components/Icons.tsx`
- Environment: `SUBSCRIBERS_TOKEN`
- Install after: storage-kv
- By hand: Choose where the list should live long-term — a provider with unsubscribe links is the honest answer; Update the copy in the sign-up card

## Store & catalogue

_A shop is a catalogue plus arithmetic plus a payment. This shelf is the first two: pricing that is exact, products a search engine and an AI agent can read, and a supplier spreadsheet that becomes a store instead of a spreadsheet._

### Storefront core: prices, catalogue, cart, checkout audit

**What it does.** Integer-penny money, a product and variant model with a completeness validator, typo-tolerant search that never dead-ends, a cart that prices discounts and delivery deterministically, a guest-first checkout audit, and performance and accessibility budgets that fail a build.

**Why the site needs it.** Every shop rebuilds the same four mistakes: prices in floating point, a cart nobody can explain, a checkout with twenty fields, and a product page that search engines and shopping agents cannot read. This is that layer, written once, with the argument for each decision attached.

**What breaks without it.** Totals drift by a penny between components, delivery and discount maths is duplicated in the UI, and there is no way to say why checkout converts badly because nothing measures it.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `commerce/src/money.ts`, `commerce/src/catalog.ts` (needs editing), `commerce/src/search.ts`, `commerce/src/cart.ts`, `commerce/src/checkout.ts` (needs editing), `commerce/src/seo.ts`, `commerce/src/budget.ts`, `commerce/src/siteModel.ts`, `commerce/src/affiliate.ts`, `commerce/catalogue/site.ts` (needs editing), `commerce/src/fixtures.ts`, `commerce/src/index.ts`, `commerce/GAPS.md`
- By hand: Add vitest and run the tests before wiring it into a UI — they are the point; Replace fixtures.ts with your own products, or import them from a supplier CSV; Decide who takes payment: the framework prices an order, it does not charge one; Read GAPS.md and pick the first gap deliberately rather than discovering it in production

### Product catalogue from a supplier CSV

**What it does.** A supplier CSV parser, column maps for four real feed shapes, per-row repair reporting, a Google Merchant feed exporter, and a build that turns the file into static product pages with structured data, llms.txt and a sitemap.

**Why the site needs it.** Products arrive as a spreadsheet from a wholesaler, and the shop has to become real pages search engines and agents can read. Importing it by hand is a week; importing it by script is a minute, and the issues report tells you which rows will fail before a customer finds them.

**What breaks without it.** Someone retypes fifty products into a CMS, the descriptions stay supplier boilerplate, the Merchant feed gets rejected for missing images, and the pages do not exist until a front end is built.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `commerce/src/csv.ts`, `commerce/src/importProducts.ts` (needs editing), `commerce/src/exportFeed.ts`, `commerce/catalogue/site.ts` (needs editing), `commerce/catalogue/render.ts`, `commerce/catalogue/scripts/build-site.mts` (needs editing), `commerce/catalogue/products.csv` (needs editing), `commerce/catalogue/scripts/serve.mjs`, `commerce/src/feedSource.ts`, `commerce/scripts/fetch-feed.mts`, `commerce/feeds/README.md`, `commerce/SUPPLIERS.md`, `commerce/COMMISSION.md`
- Install after: store-core
- By hand: Run npm run feed against the URL your supplier gives you, then npm run site on the file it saved; npm run serve:catalogue and read the home page on a phone before publishing anything; Read the issues list before publishing — every 'no GTIN' or 'repaired' line is a product that would fail later; Rewrite every supplier description — duplicate copy is the fastest way to be invisible; Replace the generated placeholder images with photography you have the rights to use; Add the build to CI so the catalogue cannot drift from the feed; Confirm VAT treatment and stock freshness for the supplier you chose

## Design & conversion

_Small mechanics with measurable effect: the action stays reachable, the page looks finished, nothing floats over the form._

### Sticky booking bar

**What it does.** Phone-only bottom bar that appears past the hero, steps aside at the form, and preselects the deposit on tap.

**Why the site needs it.** On a phone the booking button is off-screen for most of the page. The bar keeps the action one tap away, and steps aside at the form so it never covers the thing it is advertising.

**What breaks without it.** Most visitors are on a phone, scroll the whole page, and leave without ever seeing the button. Enquiry rate drops without any error being logged.

- Version: 1.0.1 · source: `connorbdigital/DJKC`
- Files: `src/components/BookBar.tsx` (needs editing), `src/index.css` (needs editing), `src/components/Icons.tsx`
- By hand: Check nothing else floats where the bar now sits

### Section-following browser colour

**What it does.** Updates the address-bar colour to the section in view, without touching the logo or favicon.

**Why the site needs it.** Small polish: browser chrome follows the section, so screenshots and shared links look deliberate. It never touches the logo or the favicon.

**What breaks without it.** Nothing breaks. The site simply looks less considered in the browsers that support it — which is most of them.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `src/utils/themeColor.ts` (needs editing)
- By hand: Register your own section colours

## Search & AI answers

_Being found and being quotable are now the same job. Static pages are read by crawlers and assistants; a JavaScript-only page is not._

### Crawlable static pages

**What it does.** Builds real HTML pages — prices, FAQs, dates, coverage — plus sitemap.xml and llms.txt from your data file, so search engines and answer bots can read the site without running JavaScript.

**Why the site needs it.** Search is where a large share of buying starts — commonly quoted at 40–60% of shoppers going straight to a search box or engine — and answer engines only quote pages they can read without running JavaScript. The generated pages are how the site gets found at all.

**What breaks without it.** The site is a single JavaScript page: crawlers index a shell, AI assistants have nothing to quote, and every price, date and FAQ is invisible to the thing people now ask first.

- Version: 1.2.0 · source: `connorbdigital/DJKC`
- Files: `scripts/build-static-pages.mts` (needs editing), `src/eventTypes.ts` (needs editing), `src/components/Occasions.tsx` (needs editing), `src/components/Reveal.tsx`, `index.html` (needs editing), `public/robots.txt` (needs editing), `src/trading.ts` (needs editing)
- Environment: `SITE_URL`
- By hand: Add a postbuild script: node --experimental-strip-types scripts/build-static-pages.mts; Replace the page bodies with this project's facts; Give every kind of booking its own entry in src/eventTypes.ts — one page per buyer, not one page listing all of them

## Data & storage

_No storage, no memory. Every other shelf depends on this one, which is why it is the first thing installed into a new project._

### Vercel KV storage layer

**What it does.** Thin wrapper over the KV REST API used by every other data feature: command(), hash pairing and constant-time token comparison. Each storage feature needs this first.

**Why the site needs it.** Every feature that remembers anything — enquiries, blocked dates, sign-ups — writes here. It is the difference between a site that collects and a site that forgets.

**What breaks without it.** Enquiries exist only in whatever mailbox caught them. The desk, the availability check and the mailing list all have nothing to read, so each feature silently stops working.

- Version: 1.0.0 · source: `connorbdigital/DJKC`
- Files: `api/store.ts`
- Environment: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- By hand: Create a KV store in Vercel and connect it to the project

## How the builder works

The steps above install a process. These are the steps the builder runs on itself.

### Take inventory

**What it does.** Reads a project's file tree, package.json, routes, tests and features.json, then reports what is actually in it.

**Why it exists.** You cannot install into a project you have not read. Without this, the first pull request collides with files that already exist and the installer looks careless.

### Preflight against the target

**What it does.** Reads the target's current files, flags collisions, missing dependencies, missing expected files, and relative imports that would not resolve after the copy.

**Why it exists.** A copy that compiles in the source project and not in the target is the normal failure. Catching it before the branch exists is the difference between a review and a repair job.

### Draft the files

**What it does.** Copies the listed files byte-for-byte from the source project, rewriting relative imports for the destination folder.

**Why it exists.** Byte-for-byte keeps the copy honest: what lands is what was tested in the source repo, with the minimum edits needed to resolve imports.

### Open a pull request

**What it does.** Creates a branch, commits the files, and opens a PR whose body lists what still needs editing by hand.

**Why it exists.** Nothing merges itself. The PR is where a human sees the file list, the environment variables and the manual steps before anything reaches production.

### Watch the checks

**What it does.** Polls the PR's check runs and reports pass, fail or still running, with a link to the failing job.

**Why it exists.** A green PR is the only signal that the copied code builds in the target's own CI, not just in the source project.

### The gate

**What it does.** Blocks the installer until a token with the right scopes is present, and refuses to touch a repository outside the account it is given.

**Why it exists.** The builder writes to real repositories. The gate is what stops a mistyped target or an under-scoped token from producing a confusing half-install.

### Site check

**What it does.** Fetches a public page and reports title, description, headings, word count, images without alt text, structured data and robots/sitemap presence.

**Why it exists.** The catalogue is only as good as its evidence. This is how a claim like 'crawlable pages' gets checked against a real URL instead of assumed.

### Cross-project code search

**What it does.** Runs GitHub code search scoped to one account or repository, groups hits by file, and highlights the matching fragment.

**Why it exists.** Before writing a feature, you check whether it already exists somewhere. Without it, the same sign-up form gets written three times in three repos.

## Dependencies

Nothing has to be installed before: `storage-kv`, `booking-chat`, `calendar-feed`, `static-seo-pages`, `sticky-cta-bar`, `theme-colour`, `store-core`.

- `booking-form-deposits` needs `storage-kv` first
- `booking-desk` needs `storage-kv` first
- `mailing-list` needs `storage-kv` first
- `blocked-dates` needs `storage-kv`, `booking-form-deposits` first
- `notifications` needs `booking-form-deposits` first
- `supplier-catalogue` needs `store-core` first

Every dependency is checked in preflight, so a missing one stops the install instead of producing a half-working copy.
