# The Studio, in the Atlas — 20 November 2026

Four things were asked for in the Atlas, and all four are now in it.

## 1. Everything in the Studio is a star

A new district, **The Studio itself**, sits on the far diagonal of the space at
`[92, 20, -92]`, opposite the Anything arm. It holds sixteen nodes, one per
surface of the Studio you actually look at:

| Star | What it is |
| --- | --- |
| The header | Title, ⌘K, Enter the City, Lock |
| The tab row | Eleven tabs in three groups |
| The gate | The front door: a token, or the two spaces without one |
| The palette | ⌘K over the whole inventory |
| ✷ Stars | Every project as a list, with Fly and Go in |
| The detail card | This card — it is what you are reading, in the world |
| A project's own space | The front page, every page on a ring |
| The City's bar | A directory of rooms |
| The notepad | A scratchpad kept in the browser |
| Full screen | The space with nothing else on it |
| The pitch sheet | The long story, one page |
| The standards | What every project here must pass |
| The Anything tab | What the deployment's key can see |
| The feel row | Look speed, style, turbo |
| The site panels | The pages framed live |
| The search | Type, and the space answers |

Each one is a `component` node (`kind: "component"`, colour `#38bdf8`), on a
ring of radius 15 around the district centre. Each carries the file that builds
it, and two links — *The file on GitHub* and *The Studio itself* — hung in its
own room as page cards when you select it. They are filterable: the **Studio
parts** chip in the head turns everything else off.

The count in the space went from 107 to 123 (126 live, with the three Anything
apps the build-time scan adds).

## 2. Clicking a star opens its own area

A star with pages is a room: selecting it flies you far enough back that the
ring of cards it opens is in the frame, not just the star in the middle. That
is true for a project, an Anything app, a component, a site. A second click on
the same star dives into its corona, as before.

## 3. No unclickable planets

The raycast was exact, which is right for a big sun and wrong for everything
else: a two-unit star forty metres away is four pixels wide, and asking a person
to hit four pixels with a mouse — or a thumb — is asking them to miss.

`nodeAt` now raycasts first, and if that misses, takes the nearest node within
**20 screen pixels** of the pointer, breaking ties by world distance so a star
behind another is not chosen over the one you can see. That is why some of the
planets could not be clicked before.

## 4. The description is a board in the space

Selecting anything hangs its card in the world: a 520 × 660 sheet in the CSS3D
layer, 13 units in front of where the flight lands, to the left, facing you. It
is the same text the panel used to hold, in the same React component — the
engine only decides where it hangs.

- **Scroll** inside it: the wheel scrolls the card. The engine does the scrolling
  by hand, because a card in a transformed layer does not reliably get a browser
  scroll chain of its own.
- **Zoom** it: `⌘`/`Ctrl` + wheel scales the card between 0.008 and 0.05, like a
  page. *Read it close* flies you to it and fills the view with it.
- **It arrives with you**: the card is kept out of sight until the flight that
  brings you to it is over, so the way in is not a wall of text flying past.
- The corner panel keeps what panels are good at — your note, the links, the
  buttons — and stops repeating the description when a board is on screen. On a
  phone, where the panel already covers the middle, the board stays hidden and
  the panel keeps the text: a duplicate behind a panel is not a board.

## What is not done

- The board is a wide-screen thing. On a phone the panel is still the only way
  to read a description.
- The card is one-sided: read from behind, the text mirrors. It is placed facing
  you and re-placed when you select something else, but flying around it will
  show its back.
- The sixteen component stars describe the Studio; they do not render it. A
  component's "own area" is its links and its card, not a live 3D copy of the
  header itself.
