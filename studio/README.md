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
└── src/components/       Gate, Projects, Packs, Features, Search, Draft, Checks, Atlas, ProjectSpace, SiteThumb
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
   - `GITHUB_TOKEN` — a read-only personal access token, so the Projects tab can read GitHub without anyone pasting a token into a browser. Without it the gate appears and asks for one, exactly as before.
   - `ANYTHING_API_KEY` — an Anything API key (anything.com → account → API keys). Without it the Anything tab says so and reads nothing.
4. Deploy. It is `noindex, nofollow` and should stay that way.

**Which variable, on which environment.** A variable scoped to production only is
absent on every preview deployment, which is where a pull request is looked at —
so the Anything key is set on all three. Verified on the `studio` project
(28 Nov):

| Variable | production | preview | development | what it unlocks |
| --- | --- | --- | --- | --- |
| `ANYTHING_API_KEY` | yes (sensitive) | yes | yes | the Anything tab, the send, and the world's Anything row + credits |
| `GITHUB_TOKEN` | yes | yes | yes | the Projects tab without the gate |
| `ANTHROPIC_API_KEY` | yes | **no** | **no** | the Agent tab — a preview deployment answers 503 |
| `VERCEL_TOKEN` | **no** | **no** | **no** | the world's deployment row; without it the row says `no VERCEL_TOKEN` |

Sensitive variables cannot be read back, by this repository or by the Vercel API —
`value` comes back empty. That is the point of the type, and it means "is the key
good?" can only be answered by *using* it: `/api/anything` answers 401 when the key
is refused and 503 when it is missing, and `/api/world` turns those into two
different sentences rather than one status code.

The Studio has **no database**. Three secrets can live on the deployment and nowhere else: the model key, `GITHUB_TOKEN`, and `ANYTHING_API_KEY`. When they are set, reads go through `/api/github` and `/api/anything`, so the browser never holds a credential just to look at something — and `/api/anything` will do exactly one write, `POST /v0/api/projects/{id}/generate`, so a brief can be sent to a project from the Anything tab without the key leaving the server. Writes — opening a branch, a file, a pull request — still ask for a token at the gate, where the person authorising it can see what they are authorising, and that token stays in `sessionStorage` and dies with the tab.

## The eight tabs

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

### On a phone, and on Anything

Under 720 px the tab strip is replaced by a **Menu** drawer that groups the eight tabs — Build, Ask and read, Look around — with the glyph, the name and the sentence for each. The grouping is a field on the tab itself (`group`), so the drawer and the strip cannot disagree.

The Anything tab lists **every** project the API returns (asked for 100, its documented ceiling) in one call, and reads a project's files and published URL only when you open it; a project the API refuses says so in its row. Before this it read the detail of the first 24 before drawing anything, which is both slower and a different claim.

### Installable, and usable with a controller

The Studio is a PWA: `public/manifest.webmanifest` (standalone, `#0A0512`, four icons including a maskable one) and `public/sw.js`, which caches the shell so the space and the shelf open with no network, and **refuses to cache anything under `/api/`** — a stale GitHub or Anything answer would be a lie. It registers only in a production build, and the header says "Offline — the space and the shelf still work" when the browser says it is.

A gamepad is two sticks, which the Atlas already had: `src/gamepad.ts` turns a standard-mapping pad into the same `setMoveInput`/`setLookInput` calls the glass sticks make — same deadzone, same clamping — polled per frame and passed on only when a number changes. A selects the nearest node (rising edge, so holding it does not re-select), triggers boost, LB/RB drop and rise.

Notes are in `atlas:notes:v1` and, per node, `atlas:node-notes:v1`. **Across devices** pushes both into a secret gist on your own account (`atlas-notes.json`) and pulls them back with a merge that lets the local pin win; a token without the `gist` scope is reported as GitHub's 403, not as success.

### Reading without a token in the browser

`api/github.ts` reads GitHub on the deployment's behalf when `GITHUB_TOKEN` is set on the project — the browser then never holds a credential, and the gate is not needed to browse. It is **read-only**: `GET` only, an allowlist of paths (`/user`, `/user/repos`, `/repos/<owner>/<repo>…`, `/search/code`, `/rate_limit`), no absolute URLs, no traversal, no credentials in the path, a 12-second timeout and a 4 MB ceiling. Opening a branch, a file or a pull request still asks for a token at the gate, where the person authorising it can see what they are authorising.

The rules live in `src/githubProxy.ts` and are tested without a request; the handler is thin on purpose. Scope note: the deployment sits behind Vercel Authentication, so "anyone who can reach the function" means anyone you let into the Studio. If the Studio is ever made public, remove this route first.

### The site check's guard rails

`api/site` has three faces: `POST` audits a page, `POST {links:true}` returns the anchors on it (for a project's space), and `GET ?thumb=<url>` returns the **link card** — `og:image` (or `twitter:image`, or `og:image:url`) made absolute, with title and description — which the Atlas draws for site and link nodes. Only https images survive, and a card is cached for an hour.

`src/sitecheck.ts` accepts https only, on the default port, with no credentials, and only public host names: `localhost`, `*.local`, `*.internal`, IP literals (including the decimal and hex aliases) and loopback/link-local addresses are refused before any request is made. `api/site.ts` then refuses redirects, requires `text/html`, times out after 8 seconds and stops reading at 1.5 MB, marking the report truncated.

That is a best-effort guard, **not a security boundary**: a hostname can resolve to a private address after the check. Run the function with restricted egress if that matters, and do not extend it into a crawler.

**The scan runs at build.** `scripts/scan-anything.mts` is the first step of `npm run build`: where the key already is, it reads `/v0/api/me`, the project list and one detail call per project, and writes `src/generated/anythingScan.json` (gitignored, regenerated every deploy). The Atlas and the City start from that file through `import.meta.glob`, so they are furnished before the first request, they survive an API outage with a note saying what they are showing, and the app's `Copy the scan` button can hand you the inventory as JSON — including when the bridge is down, which is when it is worth most. A missing key is not a failed build: the file says why, and the spaces print it.

**Anything, in full.** An app in the space is the app, not a sample of it: `toApp` keeps every module the project reports (400 is a guard, not a display choice) and `loadAnythingApps` scans up to 24 projects. Selecting an app sun lists **every part** in the panel, and *What is inside* opens them on two rings — one ring of forty labels is a word cloud. A part has no address, so the room says `a part of the app — no address of its own` and draws no stream: nothing is guessed. The City's Anything room puts one plinth per app in the same way, up to the 24 a room that size can hold.

**The Atlas** (the tab reads *Atlas (3D)*) — the whole Studio as a place you can fly through: the 13 capabilities on their sphere, the 4 packs above them, the 8 builder steps, the 3 projects, the 14 blog posts, the 7 live sites — and, when the key is set, your apps from anything.com, each with what is inside it — in seven districts, or eight once there are apps.

The space is a compass, not a scatter. Districts sit on arms of **equal length** (92 units, one ring runs through all four); eight spokes and rim ticks mark the directions; each district has a ring at the radius its own nodes stand at and a pillar up to the height it floats at, all derived from the layout, so a frame cannot drift from the data. Node sizes come from a four-step ladder, so size says what kind of thing it is rather than how loud it is. `WASD` to move, `Q`/`E` for height, drag to look, click a node to inspect, `F` to fly to it, `Z`/`C` to turn. On a phone there are **two sticks** — Move on the left, Look on the right — with lift and boost between them. **Full screen** is a button, and **Notes** is a scratchpad saved in this browser with Copy and Download .md. The district chips filter **and** travel; the search box ranks a title match above a passing mention; the minimap tells you which district you are standing in. `Enter VR` asks for a WebXR session and says **No headset** when there is none.

On a phone it is a different instrument rather than a shrunken one: a thumbstick, lift and boost pads, pinch to dolly, drag to look, a scrollable chip rail and the detail card as a bottom sheet. Portrait gets its own field of view and an overview start pose. Either way there is a **Tour** (six stops, one per district), deep links (`#atlas/<node id>`, with **Copy link** on every card), search that pulses its matches in the world, a map whose districts are buttons, and a camera position remembered between visits.

**The head.** The top of the Atlas is one measured column, not five guessed offsets: title, search, action buttons, filter chips and the search results all sit in flow inside `.atlas-head`, so a long note or a narrow window can no longer push the chips underneath the search bar. The element is measured with a `ResizeObserver` and publishes `--atlas-head`; the detail card and the sheets are placed at `calc(var(--atlas-head) + .4rem)`. The results float under the bar instead of growing it, and the button row scrolls sideways rather than breaking a label across two lines.

**Getting in, and the stars.** The gate has **Enter the Atlas →** and **Walk the City →**; the header's door button is the City, and the **Atlas (3D)** tab is the Atlas. A link skips the gate entirely — `#atlas`, `#stars` or `#atlas/<node>` for the Atlas, `#city` or `#entrance` for the City — because a space that is already open should not need a key at the door. The look is **Nebula** by default (City, Observatory and Blueprint remain in the style row and the choice is remembered).

**✷ Stars** at the top of the HUD lists every project — the recorded ones and your own — with its page count, its address, **Fly** (move the camera there) and **Go in**. `#stars` is a link straight to it. Clicking a project star in the space does the same thing: a project is the one kind of node that opens its own room on the first click.

**The City** (`src/city.ts`, `src/components/City.tsx`) — a second space, and a different kind of one: a building you walk at the scale of a person, not a solar system you fly. A corridor 61 metres long with strip lights down the ceiling, a door on each side for each district (Projects 3, Anything n, Library 13, Shelf 16, Gallery 7, Writing 14, Packs 4, Workshop 8), each door carrying a lit sign on the wall above it and a band of its district's colour across the threshold. Inside a room, every node is a plinth with a glowing orb and a name above it — click one for the same card the Atlas shows, and *Go inside* opens the project's own space. `city.ts` holds the building as data (rooms, walls, door gaps, slot grids, `canStand`, `step`), and `step` slides along a wall instead of stopping you dead, so a corridor is walkable end to end with 8 doors in the way. `Drag` to look, `WASD`/arrows to walk, `Shift` to hurry, `Q`/`E` and the wheel for pitch, `Esc` to close a card; on a touch screen the left third is a walk pad. The order is walk-scaled, not decorative: horns of the corridor are 3.4 m high, doors 2.6 m, the camera 1.62 m.

**A project's own space** (`src/components/ProjectSpace.tsx`, `src/atlasSpace.ts`) is a room cut into the space: the front page in the middle, every page of the project on a ring around it, evenly spaced and ordered by name so the shape never changes. The streams are **read off the pages**, not drawn for looks: opening the room asks `POST /api/site {url, links:true}`, which returns the anchors on each page that stay on that site — absolute, deduplicated, `mailto:`/`tel:` and fragments dropped, capped at 40. A link that the record already implied is upgraded from *record* to *read*, never duplicated. A page that refuses shows a dotted ring and says what it got — the status, or "the page map runs on the deployed Studio, not the local preview" — and no streams are invented for it. **Pick a star** shows the page's link card (the same `SiteThumb` the detail panel uses), a button to open it and one to read its links; **Read the N unread pages** works through the rest; **Every page** lists what points at what ("2 read in", "only from the record", "nothing points here"). Escape or **Back to the space** closes the room, and the project is still selected behind it.

Two things are honest by design. Many sites refuse to be framed, so a gallery panel loads its live page only when you ask and says so plainly when the frame stays blank — nothing is proxied. And Chromium does not hit-test CSS3D content, so the panels in the world are display-only: the buttons that load a page live in the HUD.

Three tools live in the same header.

- **＋ Project** puts *your* projects into the space: a name, a line about what it is, an optional link and an optional stack. They sit in the projects district on a ring outside the three built-in ones, are searchable and flyable-to like anything else, and are stored in `localStorage["atlas:projects:v1"]` — in that browser, not the repository, and the panel says so. Links must be `/`-relative or `http(s)`; duplicates replace rather than stack; 24 at most.
- **Audit** runs mechanical checks over the data the scene is built from: duplicate ids, duplicate names, nodes outside the world, dangling edges, orphans in either direction, empty districts, thin briefs, facts with no source, and — when the repository is present — posts whose proof file is missing. Findings sort worst-first and each one flies you to the node it is about. On today's data it reports one low finding, deliberately left open.
- **Scan it**, on any site card, loads that page in a panel laid over the space so you can scroll it the way a visitor would, and audits the same URL through `api/site`. Sites that refuse framing stay blank and the panel says why.

Arrival is deliberately outside the compass and above it: you see the rings, the arms and where the library sits before you walk in.

The sky is three seeded shells of stars (900 near, 1,500 mid, 2,200 far) drawn from a generated round sprite with per-star breathing and per-shell drift, four additive nebula sprites behind them, and edges that fade with distance — so depth comes from the field itself, not only from the camera.

Every node that is not a site or a post is a **sun**, not a sphere: a photosphere shader with two frequencies of granulation, limb darkening, a thin hot rim, sunspots and a slow churn, wrapped in a tight corona and a wide falloff of thrown light. Colours are the districts' own (gold packs, pink capabilities, mint steps, violet projects), with a few degrees of hue drift per star. Click a star to frame it; click it again — or press **Zoom in** on its card — to fly inside the corona and see the surface move. Diving into a site also requests its page in the gallery panel, so the preview is waiting for you. All of it is geometry and sprites, no post-processing pass, so it runs on a phone.

The blog plan is real content, not demo data — `src/atlasBriefs.ts` holds 14 briefs (about 19,200 words) for `sitebuildup.co.uk`, each with its target query, audience, service, outline, facts with a source, and the capability it demonstrates. `npm run briefs` renders them to [BRIEFS.md](BRIEFS.md). See [../docs/atlas-round-2026-11-20.md](../docs/atlas-round-2026-11-20.md).

**Anything** — your projects on [anything.com](https://www.anything.com), read with the deployment's key: name, organisation, slug, when it was last updated, credits left, filterable by name. Read-only by construction — `/api/anything` accepts `POST`, forwards a `GET`, and only to the two documented paths (`/v0/api/me`, `/v0/api/projects`), so nothing here can create, rename or delete a project. A missing key and a rejected key say different things, because the fix is different: one is a Vercel environment variable, the other is a key that is not an API key.

**Shelf** — the same thing again as a district of its own in the Atlas: what shipped at the middle, the tasks in three rings by state, and the 28 links on an outer ring in their groups. In this tab, what to do next and where everything lives, in one place, and it needs no token and no network: the same on a bad day. Three columns — **Now** (costs money or blocks everything else), **Next**, **Later** — each item carrying its reason, an effort estimate and which part of the project it touches, filterable by that. Below it: 28 links in five groups — where stock comes from (the `commerce/SUPPLIERS.md` list, with the same reasons), where you list it, reading worth doing, the accounts the work depends on, and this project's own documents — plus a table of every environment variable the two deployed projects read, what it unlocks, and what a visitor sees when it is missing. **Copy as Markdown** turns the whole shelf into text for a brief or an issue, and a test holds it to its promises: every link https with a reason, every task with an owner, and "Now" capped at five so it stays a plan rather than a backlog.

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
