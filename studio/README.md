# Studio

A private workspace for everything built here: every project and its history, a library of features that already ship, and an agent that drafts the next change as a pull request you review.

It is a separate package with its own build and its own deploy. Nothing in it is imported by the DJ site.

```
studio/
├── api/draft.ts          serverless: talks to the model, holds the key, writes nothing
├── api/site.ts           serverless: fetches one public page for the site check
├── src/github.ts         GitHub REST client: repos, activity, files, branches, pull requests
├── src/installer.ts      copies a capability's files into another repo and opens a PR
├── src/features.ts       the feature library, copied from code that already ships
├── src/packs.ts          whole setups: several capabilities, one pull request
├── src/paths.ts          prefix and branch naming shared by both
├── src/codeSearch.ts     GitHub code search: query building, result flattening
├── src/inventory.ts      what is actually in a repo: stack, counts, features with evidence
├── src/processDoc.ts     the why-layer: reasons, consequences, the builder's own steps
├── src/sitecheck.ts      URL guard and the HTML audit behind the site check
├── src/agent.ts          browser → /api/draft
├── src/atlas.ts          the space as data: 49 nodes, 6 districts, edges, search, compass
├── src/atlasBriefs.ts    the 14 blog briefs for sitebuildup.co.uk, facts with evidence
├── src/atlasEngine.ts    three.js: scene, flight, picking, labels, CSS3D site panels, WebXR
├── scripts/write-briefs.mts  renders atlasBriefs.ts → BRIEFS.md
└── src/components/       Gate, Projects, Packs, Features, Search, Draft, Checks, Atlas
```

## Run it

```bash
cd studio
npm ci           # uses the committed lockfile
npm run test     # registry, installer, preflight, adapters
npm run build
npm run dev      # http://localhost:5173, proxied by Vercel in production
```

`studio/.npmrc` sets `legacy-peer-deps=true`. Without it npm 10 fails to resolve this
dependency set on a clean checkout ("Cannot read properties of null (reading 'edgesOut')"),
which broke the Vercel build until it was pinned — leave the file and the lockfile in place.

## Deploy it

1. Vercel → **Add New → Project** → same repository.
2. **Root Directory: `studio`.** Framework preset Vite. Build `npm run build`, output `dist`.
3. Environment variables:
   - `ANTHROPIC_API_KEY` — only needed for the Agent tab. Without it the other tabs still work and the agent answers with a clear 503.
   - `STUDIO_MODEL` — optional, defaults to `claude-sonnet-4-5`.
4. Deploy. It is `noindex, nofollow` and should stay that way.

The Studio has **no database**. Your GitHub token is typed in and kept in that tab's `sessionStorage`; closing the tab locks it. Reads and writes go straight from the browser to `api.github.com`. The only server-side secret is the model key.

## The seven tabs

**Projects** — every repository the token can see, newest first, with commits and pull requests merged into one history, and a **What is in it** panel that reads the repo itself: detected stack, file/route/page/component/test counts, which library features have evidence in the code and which of those are unrecorded in `studio/features.json`, the routes and pages it serves, the env vars it expects, and the notes worth knowing (no CI, no tests, no docs, truncated tree). "Copy a summary for a brief" turns it into a paragraph. This is the answer to "what's been on this project", without needing anything from Arena: Arena's work arrives here as branches and pull requests.

**Packs** — the same files, bundled into a setup you can do in one sitting. A pack names its features, and the installer resolves the dependency order itself (storage first, then whatever writes to it), so you cannot install the cart before the horse.

- Selecting a pack reads the target's `studio/features.json` and marks each feature **already here** or **new here**, so a second install is a deliberate act rather than an accident.
- Files that several features carry — `src/components/Icons.tsx`, `api/store.ts` — are written **once**, and the panel says who shares them.
- One branch (`studio/pack-new-site-…`), one pull request, one `studio/features.json` write listing every feature with its version and the source commit. Still no merge.
- A pack is only allowed to exist if every dependency it needs is inside it. The test suite fails if a pack lists something unknown, something missing, or a loop.

Four packs ship today: **Start a new site** (storage, priced booking form with deposits, email alerts, booking chat, sticky bar, static pages), **Take bookings and run them** (adds the desk, blocked dates and the calendar feed), **Mailing list and a desk**, and **Open a product store** (the storefront core — money, catalogue, cart, checkout audit, structured data, budgets — plus the supplier CSV importer, Merchant feed and static catalogue pages that sit on top).

The store pack is how the shop gets what it needs today: `store-core` and `supplier-catalogue` are lifted from `commerce/`, so the same code that builds the demo catalogue in this repository can be copied into a store repository with one pull request. What the shop still lacks — payments, order records, returns, reviews — is written down in [`commerce/GAPS.md`](../commerce/GAPS.md) rather than pretended away.

**Feature library** — each entry is a real capability lifted from shipped code: what it does, its files, the env vars it needs, what it depends on, and what a human still has to change.

Every entry now also carries **why it is here** and **what breaks without it**, and every shelf carries a reason of its own. There are seven shelves: bookings, running the desk, marketing, **store and catalogue**, design, search, and data. Two buttons copy the whole catalogue or just the arguments as Markdown. The same text is checked into [`PROCESSES.md`](PROCESSES.md), generated from the library by `npm run processes` — a test fails if the file and the library disagree, so the document cannot rot.

The document covers all 11 processes on the 6 shelves plus the eight steps the builder itself runs (inventory, preflight, draft, pull request, checks, gate, site check, code search), each with the reason it exists.

- **Check against target** reads the destination before anything is written: files it would overwrite, relative imports that will not resolve there, and capabilities that must be installed first.
- **Copy files and open a pull request** pins the read to the source repo's current HEAD, writes the files on a `studio/feature-…` branch, records the install in `studio/features.json` inside the target (id, version, source commit, files), and opens a PR describing both.
- **Checks** then polls that branch's CI and reports pass/fail in the Studio, so "it opened" is not the same as "it worked".

**Search** — two kinds of looking.

- *Inside the projects* uses GitHub's code search across every repository the token can see, or one of them. The query is built here, not typed by hand: GitHub refuses an unscoped search, so the Studio adds `user:` or `repo:` itself. Matches are grouped by repository with the matching lines stripped of GitHub's highlight markup. The API allows roughly ten queries a minute, so a rate limit is reported as a rate limit, not as a failure.
- *One public page* fetches a single https page through `api/site` and reports what it says about itself: title, description, one headline, Product/Offer/ReturnPolicy markup, alt text, viewport, canonical, share card, readable words and document size — each with the reason it matters. Nothing is crawled, nothing is stored, and the HTML never reaches the browser.

### The site check's guard rails

`src/sitecheck.ts` accepts https only, on the default port, with no credentials, and only public host names: `localhost`, `*.local`, `*.internal`, IP literals (including the decimal and hex aliases) and loopback/link-local addresses are refused before any request is made. `api/site.ts` then refuses redirects, requires `text/html`, times out after 8 seconds and stops reading at 1.5 MB, marking the report truncated.

That is a best-effort guard, **not a security boundary**: a hostname can resolve to a private address after the check. Run the function with restricted egress if that matters, and do not extend it into a crawler.

**Atlas (3D)** — the whole Studio as a place you can fly through: the 13 capabilities on their sphere, the 4 packs above them, the 8 builder steps, the 3 projects, the 14 blog posts and 7 live sites, in six districts. `WASD` to move, `Q`/`E` for height, drag to look, click a node to inspect, `F` to fly to it, `Z`/`C` to turn. The district chips filter **and** travel; the search box ranks a title match above a passing mention; the minimap tells you which district you are standing in. `Enter VR` asks for a WebXR session and says **No headset** when there is none.

On a phone it is a different instrument rather than a shrunken one: a thumbstick, lift and boost pads, pinch to dolly, drag to look, a scrollable chip rail and the detail card as a bottom sheet. Portrait gets its own field of view and an overview start pose. Either way there is a **Tour** (six stops, one per district), deep links (`#atlas/<node id>`, with **Copy link** on every card), search that pulses its matches in the world, a map whose districts are buttons, and a camera position remembered between visits.

Two things are honest by design. Many sites refuse to be framed, so a gallery panel loads its live page only when you ask and says so plainly when the frame stays blank — nothing is proxied. And Chromium does not hit-test CSS3D content, so the panels in the world are display-only: the buttons that load a page live in the HUD.

Three tools live in the same header.

- **＋ Project** puts *your* projects into the space: a name, a line about what it is, an optional link and an optional stack. They sit in the projects district on a ring outside the three built-in ones, are searchable and flyable-to like anything else, and are stored in `localStorage["atlas:projects:v1"]` — in that browser, not the repository, and the panel says so. Links must be `/`-relative or `http(s)`; duplicates replace rather than stack; 24 at most.
- **Audit** runs mechanical checks over the data the scene is built from: duplicate ids, duplicate names, nodes outside the world, dangling edges, orphans in either direction, empty districts, thin briefs, facts with no source, and — when the repository is present — posts whose proof file is missing. Findings sort worst-first and each one flies you to the node it is about. On today's data it reports one low finding, deliberately left open.
- **Scan it**, on any site card, loads that page in a panel laid over the space so you can scroll it the way a visitor would, and audits the same URL through `api/site`. Sites that refuse framing stay blank and the panel says why.

The sky is three seeded shells of stars (900 near, 1,500 mid, 2,200 far) drawn from a generated round sprite with per-star breathing and per-shell drift, four additive nebula sprites behind them, and edges that fade with distance — so depth comes from the field itself, not only from the camera.

Every node that is not a site or a post is a **sun**, not a sphere: a photosphere shader with two frequencies of granulation, limb darkening, a thin hot rim, sunspots and a slow churn, wrapped in a tight corona and a wide falloff of thrown light. Colours are the districts' own (gold packs, pink capabilities, mint steps, violet projects), with a few degrees of hue drift per star. Click a star to frame it; click it again — or press **Zoom in** on its card — to fly inside the corona and see the surface move. Diving into a site also requests its page in the gallery panel, so the preview is waiting for you. All of it is geometry and sprites, no post-processing pass, so it runs on a phone.

The blog plan is real content, not demo data — `src/atlasBriefs.ts` holds 14 briefs (about 19,200 words) for `sitebuildup.co.uk`, each with its target query, audience, service, outline, facts with a source, and the capability it demonstrates. `npm run briefs` renders them to [BRIEFS.md](BRIEFS.md). See [../docs/atlas-round-2026-11-20.md](../docs/atlas-round-2026-11-20.md).

**Shelf** — what to do next and where everything lives, in one place, and it needs no token and no network: the same on a bad day. Three columns — **Now** (costs money or blocks everything else), **Next**, **Later** — each item carrying its reason, an effort estimate and which part of the project it touches, filterable by that. Below it: 28 links in five groups — where stock comes from (the `commerce/SUPPLIERS.md` list, with the same reasons), where you list it, reading worth doing, the accounts the work depends on, and this project's own documents — plus a table of every environment variable the two deployed projects read, what it unlocks, and what a visitor sees when it is missing. **Copy as Markdown** turns the whole shelf into text for a brief or an issue, and a test holds it to its promises: every link https with a reason, every task with an owner, and "Now" capped at five so it stays a plan rather than a backlog.

**Agent** — write a brief, tick the features it may reuse, optionally attach real source files, and get a proposal as whole files. Nothing is written until you press the second button, and the pull request says, in its own body, that it was model-drafted and must be reviewed.

### studio.json — the project's memory

Each project can carry a `studio.json` at its root:

```json
{
  "version": 1,
  "name": "Kaysie",
  "summary": "Singer and vocalist site",
  "stack": ["Vite", "React", "TypeScript", "Vercel"],
  "rules": ["Prices in GBP", "Logo stays brand pink", "No doorway city pages"],
  "design": { "palette": "pink on near-black", "type": "Unbounded / Manrope", "voice": "warm, direct" }
}
```

The Agent tab loads it and sends it with every brief, so proposals respect decisions the project already made. If it is missing, the Studio offers to open a PR that creates a starter file. This is the cheapest way to stop the output being generic.

## What it deliberately does not do

- **Merge.** No auto-merge, no force-push, no direct commits to a default branch.
- **Run code.** No execution sandbox, so nothing is tested by the Studio — that is what your CI is for.
- **Crawl.** The site check reads one page the user typed, once. There is no queue, no spider and no cache.
- **Talk to Arena.** Arena has no public API for starting sessions or reading its internals. The Studio reads the GitHub output instead, and you take briefs back into Arena by hand.
- **Store secrets.** No token database, no cookies.

### `files` versus `expects`

`files` are copied. `expects` are read but never written — your own content (`src/data.ts` with your prices), or another feature's file (`api/notify.ts`). Both are printed in the pull request under **Reads from your project**, with "(provided by this pack)" where the pack brings the file after all. The preflight lists expectations the target does not have yet, so a missing file is a warning before the PR, not a broken build after it.

The suite enforces a stronger promise than "the listed files exist": every relative import in a capability must resolve inside that capability's own files, the files of the capabilities it `requires`, or one of its declared `expects`. If a component grows a new import, `npm run test` fails until the library tells the truth about what the feature needs.

## Adding a capability to the library

Append to `src/features.ts`: `id`, `name`, `summary`, `source` (owner/name), `files` with a `role` and `adapt: true` where the file needs editing at the destination, `expects`, `env`, `requires`, `manual`. Then `npm run test` — the suite fails if a listed file does not exist in the source project, a dependency is misspelled, or an import is neither carried nor declared.

To add a pack, append to `src/packs.ts` with the feature ids and the honest `before` list. Keep it self-contained: the suite rejects a pack whose member needs something the pack does not carry.
