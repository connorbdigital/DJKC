# Two sticks, a full screen and a notepad

## Two sticks, not a stick and a swipe

The space had one thumbstick and a swipe to look. On a phone that meant the same
thumb did both jobs, and swiping to look also fought the canvas for the gesture.

Now it is a controller:

| Stick | Where | What it does |
| --- | --- | --- |
| **Move** | bottom left | push away to walk forward, sideways to strafe |
| **Look** | bottom right | push to turn: the same rate as a drag, but held |
| lift / boost | between them | rise, drop, sprint |

The maths left the component and became `studio/src/sticks.ts`, which is the
reason it can be tested: **a deadzone of 14%** so a resting thumb does not drift;
**clamped to the unit circle** so past the rim is full speed in the same
direction, not faster; **NaN-safe** so a broken pointer cannot turn the camera to
`NaN`; and `-0` normalised to `0` because IEEE arithmetic should not leak into an
input vector.

The look stick is applied **per frame**, not per move event: a stick that only
turned while your finger moved would stall the moment you held it still.

On a phone the top row drops two actions that need a bigger screen than the one in
your hand — adding a project and asking for a VR session — leaving Tour, Notes,
Full screen and Audit.

## Full screen

One button, and it is the real thing: `requestFullscreen` on the Atlas container,
`Esc` (or the button) to leave, and the label follows the browser's own
`fullscreenchange` event rather than guessing. Where a browser refuses — iOS
Safari will not full-screen a page that is not a video — it says so and points at
Share → Add to Home Screen, which does the same job.

## The notepad

A scratchpad in the HUD: a price to check, a page to look at, a sentence for a
brief. It saves **as you type** (500 ms after you stop), says *Saved on this
device* when it has, and offers **Copy**, **Download .md** and **Clear**.

Download is the important one. Text that only exists in `localStorage` is text you
lose to a cache clear, so the way out is a button, not a promise.

## Where things live now, honestly

| Thing | Where it is stored | Survives |
| --- | --- | --- |
| Notes | `localStorage` → `atlas:notes:v1` | this browser, this device |
| Your own projects in the space | `localStorage` → `atlas:projects:v1` | this browser |
| Where you were standing | `localStorage` → `atlas:pose` | this browser |
| A pasted GitHub token | `sessionStorage` | until the tab closes |
| GitHub reads | through `/api/github` with `GITHUB_TOKEN` on the deployment | server-side, no token in the page |
| Anything reads | through `/api/anything` with the Anything key on the deployment | server-side |
| Everything else in the space | the repository itself | everywhere |

There is **still no database**. What advanced is the read path: two third-party
services are now read server-side with keyless browsers. What did not advance is
persistence — notes and your own projects are per-device. Making them follow you
needs a store (Vercel KV), which is now a task on the shelf rather than a
sentence in a chat.

## Six options added to the shelf, not just suggested

These went into `Later` so they exist in the app as well as in this document:
**sync the notes off the device** (KV), **pin a note to a node**, **gamepad
support**, **a command palette (⌘K)**, **install the Studio and cache the Atlas**
(manifest + service worker), and **preview images for sites that refuse framing**
(a headless browser per page, which is why it is `L`).

## Checked

- `npx vitest run` → **17 files, 150 tests** (5 new, all on the stick maths).
- `npm run build` and `npx tsc --noEmit` clean.
- Driven headlessly at 390px: two sticks present, left stick walked the camera
  (`0,176 → 0,151`), right stick turned it (`N → W`). On desktop: notes saved to
  `atlas:notes:v1` and read back, and `document.fullscreenElement` set after the
  button.

| File | What it shows |
| --- | --- |
| [atlas-sticks-2026-11-20.png](atlas-sticks-2026-11-20.png) | 390px: Move and Look, with lift/boost between them |
| [atlas-notes-2026-11-20.png](atlas-notes-2026-11-20.png) | The notepad over the space, saved and counted |
| [atlas-fullscreen-2026-11-20.png](atlas-fullscreen-2026-11-20.png) | The same page full screen, the button now reading *Exit* |
