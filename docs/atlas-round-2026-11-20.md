# The Atlas — one space for everything the Studio knows

Built 20 Nov 2026. It lives in the Studio at the **Atlas (3D)** tab, and it opens
without a GitHub token: the gate has a second button, *Walk through the Atlas
first*, because the space is local data, not an API call.

![The gate, with the no-token way in](atlas-gate-2026-11-20.png)

## What is in the space

49 nodes, six districts, laid out as a place rather than a list:

| District | Nodes | What is there |
| --- | --- | --- |
| **The library** | 13 | Every capability the Studio can install, on a golden-angle sphere so no two labels collide |
| **Pathways** | 4 | The packs — whole setups installed as one pull request — hanging above the library, wired to the capabilities they contain |
| **The builder** | 8 | The Studio's own process, step by step, down the left side |
| **The projects** | 3 | This site, the shop, and DJKC — in a ring, sized by what they contain |
| **The blog plan** | 14 | Every post for `sitebuildup.co.uk`, as a two-row wall of cards you can read from across the room |
| **The gallery** | 7 | Live sites as panels in the world |

![The opening view: builder steps left, library and pathways centre, projects right, blog plan in front](atlas-opening-2026-11-20.png)

World coordinates are multiplied by `WORLD_SCALE = 0.62` at the end of
`buildAtlas()`, so the districts are authored at a comfortable spacing and then
compressed for walking speed. The map in the bottom-left corner is the same data
drawn flat, and it tells you which district you are standing in.

## Flying it

| Input | Does |
| --- | --- |
| `W` `A` `S` `D` | Move along the ground plane |
| `Q` / `E` | Down / up |
| `Shift` | Boost (3.2×) |
| Drag | Look |
| Scroll | Dolly forward |
| `Z` / `C` | Turn without the mouse |
| Click a node | Inspect it: the HUD card on the right carries the detail |
| `F` | Fly to the selected node, then look at it |
| District chips | Filter to one kind of thing **and** travel to its district |
| Search box | Search the space — see below |
| `Enter VR` | WebXR, if a headset is attached |

The camera is clamped inside a 300-unit radius and below 160, so you cannot get
lost outside the space. Arriving at a node is a timed flight, not a teleport: the
frame loop eases position and look angles together.

## Search

`searchAtlas()` scores each node field by field:

| Where the word appears | Weight |
| --- | --- |
| The title | 8 |
| The summary line | 5 |
| The bullets | 3 |
| The body | 1.5 |

Whole-word beats substring, so **"affiliate" opens the post about affiliate
commission (£3.99 or £3.71), not the shop that mentions it in its detail**, and
there is a test that says so. Empty or nonsense queries return nothing rather
than noise. `bestMatch()` is the "fly to what the query means" version of the
same thing.

## The blog plan

14 posts, about 19,200 words as briefs, all written for **sitebuildup.co.uk** and
all arguing from a number this repository can show:

- Your checkout is losing 7 in 10 baskets
- Show the delivery price before the pay button
- 100 ms of load time is worth 3.5% of revenue
- The search box is a revenue surface, and 70% of queries fail on it
- Getting quoted by ChatGPT and Perplexity
- The product schema that earns the click
- £3.99 or £3.71: the 28p that decides whether you hold stock
- Twelve departments, not a "shop" page
- Returns are a marketing channel
- Why every change we make opens a pull request first
- Buy the boring parts: four things no small business should build
- What a fixed-price website should include (and what "from £795" must not hide)
- `llms.txt` in practice
- What 287 tests look like to a client who cannot read code

Each brief carries the target query, the audience, the service it sells, an
outline, the facts with **evidence** (a file path, a provider's terms, a test
count), and the capability it demonstrates. `npm run briefs` renders them all to
[`studio/BRIEFS.md`](../studio/BRIEFS.md).

![A post's card, and the brief behind it](atlas-brief-2026-11-20.png)

Clicking the card flies to it and opens the brief in the HUD — the promise, the
outline, and every fact with its source.

![The whole blog plan, filtered to Blog plan 14](atlas-blog-plan-2026-11-20.png)

## The gallery

Seven sites stand in a row at the far end, each a CSS3D panel in the 3D scene.
Select one and choose **Load the live page** to put the real page inside its
frame; **Open** takes you to it in a tab.

![The gallery, with a live page requested](atlas-gallery-2026-11-20.png)

Two honest limitations, both visible in the UI rather than hidden:

- **Sites refuse to be framed.** `sitebuildup.co.uk` sends framing headers, so
  the frame stays white and the panel says so, with the tab link. Nothing is
  proxied, scraped or faked, and the note in the panel says that too.
- **Chromium does not hit-test CSS3D content.** Buttons inside the 3D panels
  cannot receive a click, so the panels are display-only and the real controls
  live in the HUD. That is why the engine binds input to the stage element that
  holds both layers, and why a drag that starts on a panel is ignored.

## VR

`enterVR()` asks the browser for an immersive session; if there is none, the
button says **No headset** instead of pretending. In a session the HUD and the
CSS3D panels hide and the controllers teleport you along the ray.

**Not verified on hardware.** The checks in this repository ran in headless
Chromium, which has no WebXR device, so the honest statement is: the fallback is
tested, the session path is guarded and typed, and a headset has not been tried.

## What is checked

- `npx vitest run` in `studio`: **102 passed**, 23 of them about the space — node
  count and uniqueness, every node in a real district, finite coordinates inside
  bounds, edges that resolve, search ranking, briefs that name real capabilities,
  and a floor on how many briefs carry evidence.
- The whole repository: **287 tests** (66 site, 102 studio, 119 commerce).
- `npm run build` in `studio`: 279.63 kB main chunk, and the Atlas as its own
  lazy chunk of 596.62 kB — three.js is only downloaded when someone opens the
  space.
- A browser walk in Chromium: the gate opens the space, the canvas draws, search
  flies to a post, a site's panel loads a live page, the district chips travel,
  `W` moves, and **zero console or page errors**.

## Second pass: phones, and more to do in the space

![The tour, mid-flight](atlas-tour-2026-11-20.png)

### What was actually broken on a phone

An audit at 390 × 844 with touch emulation found five real faults, not a
cosmetic one among them:

1. **An old `max-width: 720px` block hid the title and the minimap outright**,
   left over from a previous round and never revisited.
2. **The header wrapped into three rows that overlapped**: the action buttons sat
   on top of the search field and the filter chips cut through both.
3. **There was no way to move.** The space answered `WASD`, `Q`/`E` and `Shift`
   and nothing else, so on a phone you could look around and that was all.
4. **Portrait framing was wrong.** At the desktop 62° vertical FOV, a 390 px wide
   window sees a 31° horizontal slice: the whole atlas became a speck in a tall
   black screen.
5. **The detail card covered the world** and its buttons fell below the fold.

### What the space does now

| Touch | Does |
| --- | --- |
| Thumbstick (bottom left) | Move, in the direction you push |
| Drag anywhere else | Look |
| Pinch | Dolly forward and back |
| Tap a node | Inspect it |
| ↑ / ↓ pads | Rise and drop |
| ⚡ pad | Boost |

- **Portrait gets its own framing**: `responsiveFov()` widens the vertical field
  of view as the aspect narrows (capped at 86°), the start pose becomes an
  angled overview at `(0, 52, 104)` instead of the desktop entrance, and the
  pixel ratio is capped at 1.5 on coarse pointers.
- **The HUD is rebuilt for small screens**: one compact bar, a scrollable chip
  rail, the detail card as a bottom sheet with sticky actions, and a smaller
  minimap with each district tappable.
- **The dock is the instruction manual** — "drag to look, pinch to zoom, tap a
  node" replaces the keyboard legend, which is meaningless on glass.

### And more to do, on both

- **A guided tour**: six stops, one per district, each with a sentence; any input
  hands control straight back.
- **Deep links**: `#atlas/brief-affiliate-vs-resell` opens the space looking at
  that node, and every card has a **Copy link** button.
- **Search you can see**: matched nodes pulse and glow in the world while the
  query is live, not just in the list.
- **A working map**: district dots on the minimap are buttons that fly you there,
  and the dot for where you are standing is drawn larger.
- **Your place is remembered**: the camera position is written to
  `localStorage` every second and restored on return — not on tab close, because
  a page unload does not reliably run React's cleanup.
- **A pointer that knows**: hovering a node changes the cursor and lifts the node
  under it (desktop only).
- **Bounded, everywhere**: the flight clamp now runs in one place, so pinch and
  the thumbstick cannot push you outside the space either.

![Mobile, on arrival](atlas-mobile-2026-11-20.png)

![Mobile, inspecting a node](atlas-mobile-brief-2026-11-20.png)

### Checks

- `npx vitest run` in `studio`: **105 passed** — three new tests cover the FOV
  curve, the deep-link parser and the tour's integrity (every stop a real
  district, every named node real, no district twice).
- `npm run build`: 279.64 kB main chunk, `Atlas` 604.62 kB lazy.
- Chromium at 390 × 844 with touch: gate → space, thumbstick moves the camera,
  a real two-finger pinch dollies it (z 104 → 85), a chip flies to its district,
  a result opens the bottom sheet, the tour captions advance, deep links open,
  and **zero console or page errors**.
- Chromium at 1400 × 900: the desktop layout is unchanged apart from the new
  Tour button and Copy link action.

**Not verified:** a physical iOS or Android device, and VR on hardware. The walk
above is emulated touch in desktop Chromium; it exercises the same pointer events
a phone sends, but it is not a phone.

## Files

```
studio/src/atlas.ts          the data: nodes, districts, edges, search, compass
studio/src/atlasBriefs.ts    the 14 blog briefs, with facts and evidence
studio/src/atlasEngine.ts    three.js: scene build, flight, picking, labels, panels, WebXR
studio/src/components/Atlas.tsx  the HUD: search, filters, detail card, minimap
studio/src/atlas.test.ts     23 tests, no three.js needed
studio/scripts/write-briefs.mts  renders BRIEFS.md
```
