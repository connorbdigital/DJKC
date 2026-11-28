# No blocks, and a second view that opens in the Atlas

Two changes, both in `studio/src/atlasEngine.ts` (plus `src/atlas.ts` for the
data and `src/components/Atlas.tsx` / `src/styles.css` for the HUD), 20 Nov 2026.

## 1. The stars and planets were blocks — what they actually were

Third report, so this time the geometry was checked rather than assumed.

| what | how it was drawn | why it read as a block |
| --- | --- | --- |
| the 8 sites | `BoxGeometry(1.7s × 1.1s × 0.14)` — a flat slab with a frame | literally a rectangle, side-on at distance |
| the space at distance | every node had a soft `nebulaTexture()` corona at the same position as its sphere | half the sprite sat inside the opaque sphere, so the glow was hidden and all that was left was a matte ball |
| every name | `labelSprite()` painted `rgba(10,5,18,0.55)` behind the text | at 200 m that fill is a dark plaque hanging in the sky |
| briefs (14) | `cardSprite()` glass cards | rectangles — already culled beyond 46 m, so not the cause |

What changed:

- **A site is a ringed planet**: a sphere with `sunMaterial()`, plus a `TorusGeometry`
  ring. Nothing in the space is a rectangle any more.
- **A corona is a halo, not a blob**: `haloTexture()` — light *around* a star with the
  middle left clear — drawn with `depthTest: false` and a `renderOrder`, so the star
  keeps its surface and the light spills past its edge. Every node gets one.
- **Names have no plate**: shadowed type only, and names fade out past ~180 m
  instead of shrinking into dark smears.
- **Wires are never hidden**: `updateEdges()` no longer gates the `proves` family on
  a brief being selected — last turn's "streams always on" was true only until the
  first click.

## 2. A second view: the node opened *in* the space

Not the overlay room (`ProjectSpace3D`, untouched), and not a panel: the space
itself reorganises around the star you opened.

- The **landing page hangs above the middle**, as the real page — fetched through
  `/api/site?page=` (the server-side sanitiser), so a site that refuses framing
  still shows, and a site that cannot be read leaves the frame empty rather than
  showing an invented page.
- The node's **other pages are planets** on an upright halo around it, each with its
  name under it in DOM (crisp at 200 m, unlike a canvas sprite).
- **Every link read off those pages runs as a stream**: `POST /api/site {url,
  links:true}` per page, and each link that lands on a page in the ring is drawn as
  an arc with particles travelling along it.
- **What it is connected to** is the outer ring: its neighbours in the graph, joined
  by the pathways that already exist between them.
- The HUD shows `Inside · <name>` with **Back to the space**; Escape closes it. The
  other stars' plate panels are hidden while you are inside one node, and restored
  on the way out.
- Pages get their ring from the record: `pages` on a site node is now the landing
  page first, then each funnel step (`src/atlas.ts`), so 6 of 8 sites open with
  pages and the two with a funnel open with five.

## Verified

- Studio: **361 tests / 38 files**, `tsc` clean, `vite build` green.
- New tests: a site's pages start with its landing page; every funnel step has a
  page on its own host; no page is listed twice.
- Screenshots (mocked `/api/site`, as the sandbox cannot reach the real hosts):
  `docs/atlas-no-blocks-2026-11-20.png`,
  `docs/atlas-inside-in-space-2026-11-20.png`.

## Honest gaps

- The link streams are only as good as `/api/site` on the deployed Studio; the
  screenshots use mocks. Real hosts have never been fetched from this sandbox.
- A page's plate image is not used in this view — the ring is names and planets,
  not thumbnails.
- The halo is a fixed radius, so a site with twelve pages will crowd it; the ring
  only scales between 26 and 40 units.
- Sites without a funnel open with one planet (their landing page) and no internal
  streams; only their neighbour pathways are drawn.
