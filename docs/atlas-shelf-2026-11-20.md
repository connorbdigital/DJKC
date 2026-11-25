# The Shelf joins the space, and a site answers for itself

Two things: the shelf is now somewhere you can stand, and a site opens what is
on it instead of describing itself in the abstract.

## The shelf is a district

It sits on the **south-east diagonal** — the mirror of the Anything arm — and it
is three rings and a list, inside out:

| Ring | What is on it | Why in that order |
| --- | --- | --- |
| **8 units** | the 7 rounds that shipped | the ground you already stand on is at the middle |
| **23 / 30 / 37** | the 15 tasks: **Now** (4), **Next** (5), **Later** (6) | the work waiting on you wraps around what shipped, one ring per state |
| **48** | the 28 links, in their five groups, in the order the Shelf prints them | reference is the outside: you go to it, it does not come to you |

Each task carries its state, its effort and the part of the project it touches,
plus the reason it exists. Each link carries why you would open it and goes
straight there. Each shipped round carries what changed, why, and the pull
request that did it — PR #20 shelf, #21 GitHub proxy, #22 Anything, #23 compass,
plus the Studio, the storefront and the bookings.

Colours are new but in family: lime for **Next**, steel for **reference**,
violet for **what shipped**. Ten kinds now, ten distinct colours, and a test
holds that — no two districts wear the same one.

Two engine changes made forty extra suns affordable: **one sphere geometry per
size** rather than one per node, and a **tighter corona** on the small, numerous
kinds, because a nine-unit halo on a two-unit sun turns a shelf into a smear at
ten paces.

## A site answers for itself

Every page in the gallery now carries a record:

- **what it is**, in one line;
- **what is there** — pages, parts, counts. Ours are facts (the 32 products, the
  50 generated pages, the deposit at the end of the form); theirs are the things
  worth copying, stated as such;
- **what to look at** — three specific things, not "explore the site";
- **the supplier view**, where one exists: *gives you / asks for / check first*,
  the same shape as `commerce/SUPPLIERS.md`. It is there for the two sites this
  project actually owns and absent everywhere else, because inventing a supplier
  record for Amazon would be a lie with a table around it.

And **one click opens the page**: selecting a site in the space now requests it
in its gallery panel immediately, instead of waiting for a second click. If the
site refuses to be framed the panel says so and the tab link is still the way in.

The detail card renders these as named sections, which meant one honest addition
to the node model: an optional `sections` list, so a node can say more than a
paragraph and three bullets without turning `detail` into a wall of text.

## Checked

- `npx vitest run` → **16 files, 145 tests** (8 new).
- `npm run build` clean; `npx tsc --noEmit` clean.
- Screenshots from the built bundle with `/api/anything` stubbed.
- Verified in a headless browser: the three section headings render on a site's
  card, and the gallery panel receives an `iframe` on a single selection.

| File | What it shows |
| --- | --- |
| [atlas-shelf-shipped-2026-11-20.png](atlas-shelf-shipped-2026-11-20.png) | The shelf district: the shipped ring inside, the task rings beyond |
| [atlas-shelf-links-2026-11-20.png](atlas-shelf-links-2026-11-20.png) | The outermost ring: 28 links, evenly spaced, in their groups |
| [atlas-site-detail-2026-11-20.png](atlas-site-detail-2026-11-20.png) | A site's card: what is there, what to look at, the supplier view — with its page requested in the space |
