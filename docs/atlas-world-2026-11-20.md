# The world: the space is now told what it is made of

The Atlas was a picture of the repository. Every star was compiled in, so the
only way to change the space was to deploy it. This turn gives the space a
**world snapshot** — one versioned document, built on the server — and makes the
sync state part of the space rather than an assumption.

## What shipped

**`GET /api/world`** (`studio/api/world.ts`)

- One snapshot: `{ version, builtAt, sources, apps, deployments, counts }`.
- Sources: **Studio** (the compiled inventory — it cannot fail, which is why the
  space always has shape), **Sites** (8 sites, 15 pages), **GitHub**
  (`GITHUB_TOKEN` present or not), **Anything** (read through this deployment's
  own `/api/anything` bridge, so the key never moves and there is one place to
  fix when Anything changes), **Vercel** (last production deployments, if a
  `VERCEL_TOKEN` exists — otherwise one sentence saying it does not).
- 60-second cache, `ETag` = the content version, `?fresh=1` to bypass.
- Read-only (GET; POST answers 405). No credential is ever in the body — a test
  asserts the GitHub token does not appear in the response.

**`studio/src/world.ts`** — the browser's reading of it: validation of every
field that crossed a network, a content-only `worldVersion` (FNV-1a over node
ids, app module counts and deployment states), `sameWorld` so a poll that finds
nothing new rebuilds nothing, `worldTone` (live / partial / stale / none),
`chipLine`, `describeWorld`, `describeSources`.

**The space itself**

- A **world chip** in the head row: `◉ Partial 3/5 · 02:15`, tinted by state,
  with the full sentence per source in its tooltip. Clicking it forces a fresh
  read. A failed snapshot prints a line explaining that the space is the build.
- **Beacons in the space**: five small planets on a ring above the hub, one per
  source, green for answered and red for not, named and counted, joined by
  faint spokes back to the middle. "Is this live?" is answered by looking.
- Polls every 60 seconds. A different version is the only thing that rebuilds
  anything.

**Everything from the Studio, in the space**

- **Universal** and **Agent** now have stars of their own on the Studio arm.
- The surfaces that are tabs — **Standards**, **Pitch sheet**, **Anything**,
  **Universal**, **Agent**, **Search** — now carry an *Open it in the Studio*
  page (`#tab=…`), so their page ring is a way in, not a description of one.
- The Studio arm splits into two rings (12 + 8) now that it holds 20 stars.
- Fixed a **404 in space**: the pitch sheet's star pointed at
  `PitchSheet.tsx`, which does not exist. It points at `Pitch.tsx`.

## Verified

- Studio: **386 tests / 40 files**, `tsc` clean, `vite build` green.
- New: `src/world.test.ts` (19, pure rules) and `src/worldHandler.test.ts` (6,
  the endpoint: keyless behaviour, Anything through the bridge, a refused
  bridge as a sentence, read-only, stable version/ETag, and no token in the
  answer).
- Live in dev: `{"nodes":127,"edges":38,"districts":8}` with
  `anything: 503 Service Unavailable` and `vercel: no VERCEL_TOKEN…` — the chip
  reads `◉ Partial 3/5`.
- Screenshot: `docs/atlas-world-sources-2026-11-20.png`.

## Honest gaps

- The snapshot is **not yet what the geometry is built from**: the stars still
  come from `buildAtlas()`, and the world supplies the apps, the counts and the
  freshness. The next step is the same document carrying the node list.
- **Polling, not push.** 60 seconds, no SSE. A change is up to a minute old.
- **Anything's apps arrive without their modules** through the world (the detail
  calls are deliberately not made per cold start); the browser's own loader is
  still what gives an app its parts.
- **Vercel is untested against the real API** — there is no token on this project
  yet, so the branch that reads deployments has never run.
- The beacons are five fixed positions; add a source and the ring re-spaces but
  the labels do not wrap.
