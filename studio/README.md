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
├── src/sitecheck.ts      URL guard and the HTML audit behind the site check
├── src/agent.ts          browser → /api/draft
└── src/components/       Gate, Projects, Packs, Features, Search, Draft, Checks
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

## The five tabs

**Projects** — every repository the token can see, newest first, with commits and pull requests merged into one history. This is the answer to "what's been on this project", without needing anything from Arena: Arena's work arrives here as branches and pull requests.

**Packs** — the same files, bundled into a setup you can do in one sitting. A pack names its features, and the installer resolves the dependency order itself (storage first, then whatever writes to it), so you cannot install the cart before the horse.

- Selecting a pack reads the target's `studio/features.json` and marks each feature **already here** or **new here**, so a second install is a deliberate act rather than an accident.
- Files that several features carry — `src/components/Icons.tsx`, `api/store.ts` — are written **once**, and the panel says who shares them.
- One branch (`studio/pack-new-site-…`), one pull request, one `studio/features.json` write listing every feature with its version and the source commit. Still no merge.
- A pack is only allowed to exist if every dependency it needs is inside it. The test suite fails if a pack lists something unknown, something missing, or a loop.

Three packs ship today: **Start a new site** (storage, priced booking form with deposits, email alerts, booking chat, sticky bar, static pages), **Take bookings and run them** (adds the desk, blocked dates and the calendar feed), and **Mailing list and a desk**.

**Feature library** — each entry is a real capability lifted from shipped code: what it does, its files, the env vars it needs, what it depends on, and what a human still has to change.

- **Check against target** reads the destination before anything is written: files it would overwrite, relative imports that will not resolve there, and capabilities that must be installed first.
- **Copy files and open a pull request** pins the read to the source repo's current HEAD, writes the files on a `studio/feature-…` branch, records the install in `studio/features.json` inside the target (id, version, source commit, files), and opens a PR describing both.
- **Checks** then polls that branch's CI and reports pass/fail in the Studio, so "it opened" is not the same as "it worked".

**Search** — two kinds of looking.

- *Inside the projects* uses GitHub's code search across every repository the token can see, or one of them. The query is built here, not typed by hand: GitHub refuses an unscoped search, so the Studio adds `user:` or `repo:` itself. Matches are grouped by repository with the matching lines stripped of GitHub's highlight markup. The API allows roughly ten queries a minute, so a rate limit is reported as a rate limit, not as a failure.
- *One public page* fetches a single https page through `api/site` and reports what it says about itself: title, description, one headline, Product/Offer/ReturnPolicy markup, alt text, viewport, canonical, share card, readable words and document size — each with the reason it matters. Nothing is crawled, nothing is stored, and the HTML never reaches the browser.

### The site check's guard rails

`src/sitecheck.ts` accepts https only, on the default port, with no credentials, and only public host names: `localhost`, `*.local`, `*.internal`, IP literals (including the decimal and hex aliases) and loopback/link-local addresses are refused before any request is made. `api/site.ts` then refuses redirects, requires `text/html`, times out after 8 seconds and stops reading at 1.5 MB, marking the report truncated.

That is a best-effort guard, **not a security boundary**: a hostname can resolve to a private address after the check. Run the function with restricted egress if that matters, and do not extend it into a crawler.

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
