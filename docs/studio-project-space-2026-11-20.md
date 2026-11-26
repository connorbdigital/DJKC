# Going into the City, finding the stars, and what is inside a project

Three questions, three answers, all of them links.

## 1. How to go into the City

Four ways in, in the order most people meet them:

| Way | Where |
| --- | --- |
| **Enter the City** on the gate | `https://studio-connorbdigital.vercel.app/` — the front door. No token needed |
| **The City** tab | The tab used to read *Atlas (3D)*; same room, its own name now |
| **Enter the City** button | Top right of the Studio, on every tab |
| A link | `#city` or `#atlas` opens the City **without the gate** — the gate is a front door, not a wall in front of an open room |
| A link to a project | `#atlas/project-djkc` lands **inside that project's room**. `Esc` drops you into the City with the project still selected |

The City's look is now **City** by default (it was Nebula). The other three —
Nebula, Observatory, Blueprint — are still in the style row at the bottom, and
whichever you pick is remembered on that device.

## 2. Where the stars are

**✷ Stars** sits at the top of the City, next to Tour. It opens the list of every
project — the ones written down in `studio/src/atlas.ts` and the ones you added
yourself from the ＋ Project panel:

- a filter box, because there are more than three;
- each row says how many pages we hold and the address;
- **Fly** moves the camera to that star in the space;
- **Go in** opens its room.

`#stars` is a link straight to the list.

There is a second way that is closer to how people actually browse: **click a
star in the space**. A project is the only kind of node that opens its own room
on a single click; everything else still opens the detail panel.

## 3. What is inside a project

One screen, cut into the City: a circle is a page, a line is a link.

- **The front page is the big circle in the middle.** Every other page sits on a
  ring around it, evenly spaced and alphabetically ordered, so the shape is the
  same every time you open it.
- **Solid pink lines are real.** Each one was read from an `<a href>` on the page
  it starts at, by `POST /api/site {url, links:true}`.
- **Faint dashed lines are from the record.** The project's page list says the
  page exists; nobody has read that page's own links yet.
- **A dotted ring means the page refused.** The reader got an error and the
  space says which: the status, or "no answer — the page map runs on the deployed
  Studio, not the local preview". Nothing is guessed.
- **The headline** counts pages, pages read, and links read.
- **Pick a star** shows the page's card (the same `SiteThumb` the detail panel
  uses), **Open the page**, and **Read its links**. Reading it again is safe: a
  stream already drawn is upgraded from *record* to *read*, never duplicated.
- **Read the N unread pages** reads everything left in one go.
- **Every page** is the list underneath, with what points at each one:
  "2 read in", "only from the record", "nothing points here".
- On a phone the map comes first, then the list; there is no sideways scroll.
- **Escape** or **Back to the City** closes the room. The detail panel behind it
  keeps the project selected, so the next click is where you were.

Nothing behind a form, a login or a script is visible, and the room says so in a
line at the bottom rather than pretending the map is complete.

## The City's head now measures itself

The bar at the top of the City — name, search, buttons, the chips, the results —
used to be five things placed at offsets guessed from the top of the screen
(`top: 4.6rem` for the chips, `7.4rem` for the results, and so on). One extra
line under the title, or a width where the buttons wrapped, and the chips came
up underneath the search: the search bar sat **over the buttons**.

It is now one column. `Atlas.tsx` puts the title, search, actions, chips and
results inside `.atlas-head`, everything in flow, so nothing can land on
anything else at any width. The same element is measured with a
`ResizeObserver` and publishes `--atlas-head`; the detail card, the add-project
sheet, the audit sheet and the phone's help line are placed at
`calc(var(--atlas-head) + .4rem)` instead of a number that was true once. The
results float under the bar rather than growing it, so a search does not dim any
more of the room than the bar already does.

Two smaller things came out of the same fix: the head is `pointer-events: none`
with its children taking them, so dragging the world from the empty part of the
top strip works; and the button row never breaks a label across lines — it
scrolls sideways on a phone the way the chips do.

Checked in headless Chromium at 1440, 1100, 860 and 390 wide: no intersection
between the search, the buttons, the chips, the note and the results at any of
them, and the detail card and audit sheet sit below the measured bar.

## What it cost, and what it still cannot do

- **Read on open:** the front page and up to three more, then the rest on demand.
  Fine for a handful of projects; nothing is cached between visits.
- **Script-built navigation is invisible.** A site that draws its menu in
  JavaScript shows its ring and few streams — see gap 31 in
  [not-yet-done](not-yet-done-2026-11-20.md).
- **No writes.** Opening a room reads pages. It changes nothing anywhere.

## Tests

`studio/src/atlasSpace.test.ts` — 12 tests: stable ring order, trailing slash and
fragment treated as one page, anchors made absolute and filtered to the site,
off-site and `mailto:` dropped, the cap honoured, a stream upgraded rather than
drawn twice, the busiest page ranked first. Studio total: **246**.
