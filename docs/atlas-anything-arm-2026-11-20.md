# The Atlas: an Anything arm, and a compass under it

Two changes in this round: the apps on anything.com now stand in the space, and
the space itself is measured rather than scattered.

## Every app on anything.com, and what is inside it

The Atlas had every process, pack, builder step, project, blog brief and live
site. It now also has **your Anything apps**, read at runtime through the same
read-only route the Anything tab uses:

- `GET /v0/api/projects` gives the list;
- `GET /v0/api/projects/{id}` gives each app's **modules** (`files[].name`,
  `moduleType`), its `platform` (web / mobile / both) and its
  `latestPublishedUrl`.

Each app becomes a sun on its own arm of the space. Its card says what it is,
what is inside it, when it last changed, and — if it has ever been published —
opens the running app. An app that has never been published says so instead of
inventing a link.

**The arm exists only when there is something on it.** No key, a rejected key,
or an empty account leaves the Atlas exactly as it was, and the filter chip
reads `Anything 0`. Nothing here creates, renames or deletes anything: the proxy
forwards two list reads and one project's detail, and no other path.

## The space is a compass

The layout was already deterministic but it was placed by hand. It is now
measured:

| Rule | What it means |
| --- | --- |
| **Equal arms** | Projects east, builder west, pathways north, the blog plan south — all at 92 units from the library, so **one ring runs through all four**. Anything takes the north-west diagonal, the corner of that square. |
| **Eight spokes** | Radial lines at 45° with rim ticks, so a direction is a place you can fly to rather than a bearing you guess. |
| **A ring per district** | Each district's ring is drawn at the radius its own nodes occupy, computed from them — move a node and the frame moves with it. |
| **A pillar per arm** | Each district has a short pillar from the floor to the height it floats at, so an arm has a floor and a place. |
| **Four sizes** | `2 / 2.6 / 3.4 / 4.4` replace six ad-hoc radii. Size now means *what kind of thing this is*, not how loudly it wants attention. |
| **Signs overhead** | District labels sit 24 units above their arm and fade as you walk under them, instead of filling the sky at close range. |

Colours did not change: every sun keeps its own, per the standing instruction.
The bloom did not grow: the four distant glows were moved out to 600+ units and
thinned, because at the new arrival distance two of them read as moons.

Arrival moved too — back to `(0, 44, 146)` at a shallow downward pitch, so you
see the rings, the five arms and the library before you walk in. Phones get a
higher, wider version of the same view.

## Checked

- `npx vitest run` → **16 files, 138 tests** (8 new: the arm appears only with
  data, one sun per app, modules in the card, `https`-only links, an unpublished
  app saying so, the authored nodes not moving, determinism, and the client's
  parsing, partial-failure and limit behaviour).
- `npm run build` clean; `npx tsc --noEmit` clean.
- Screenshots below are the built bundle with `/api/anything` stubbed, because
  this sandbox cannot reach `api.anything.com`.

| File | What it shows |
| --- | --- |
| [atlas-compass-2026-11-20.png](atlas-compass-2026-11-20.png) | Arrival: rings, spokes, five arms, the blog wall readable, the Anything arm upper-left |
| [atlas-anything-arm-2026-11-20.png](atlas-anything-arm-2026-11-20.png) | The Anything arm: three app suns, its own ring and pillar, the sign overhead |
| [atlas-compass-mobile-2026-11-20.png](atlas-compass-mobile-2026-11-20.png) | 390px: the same compass from the higher portrait pose |
