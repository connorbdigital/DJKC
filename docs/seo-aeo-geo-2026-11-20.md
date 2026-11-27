# The rules, gathered — and what the site now does about them

The ask was to gather everything that makes the best site for **SEO**, **AEO**
(answer engines: snippets, voice, chat) and **GEO** (generative engines: AI
Overviews, ChatGPT, Perplexity, Claude, Gemini). This is the gather: what the
2026 canon actually says, which parts of it are evidence and which are hopes,
and what was changed on the site in this pass.

## The canon, in the order it matters

| # | Rule | Why it works | Where it is applied |
| --- | --- | --- | --- |
| 1 | **Answer first.** The opening 30–60 words of each section answer its heading, self-contained. | Generative engines lift that block almost verbatim; bury the answer and there is nothing clean to quote. | `src/eventTypes.ts` — every page opens with a 40–60 word `answer`, asserted by test |
| 2 | **Question-shaped headings.** H2/H3 phrased as the question a person types. | Matches intent exactly; survives extraction as a Q&A pair. | Every occasion page's sections and FAQs |
| 3 | **One page per buyer, not one page per service list.** A city or occasion page with genuinely local/own material. | Templated "areas we serve" lists get treated as thin content; distinct pages rank for distinct intents. | Six new occasion pages + the hub; each with its own price, facts and caveats |
| 4 | **Sourced numbers inline.** A stat with its origin in the same sentence. | Second-highest lift in the GEO literature; floating claims do nothing. | UK price bands on `/how-much-does-a-dj-cost.html` carry their basis ("published booking-platform averages") |
| 5 | **A canonically phrased entity.** One sentence describing who you are, used everywhere. | Stops engines blending you with a same-named act. | `CANONICAL_DESCRIPTION` in `src/eventTypes.ts`, used in pages, schema and `llms.txt` |
| 6 | **Schema as a parsing aid, not a growth hack.** Organization/PerformingGroup, Service, FAQPage, BreadcrumbList, WebPage with dates. | It reduces ambiguity. Google's line is that AI features do not require it; ChatGPT/Perplexity/Claude do read it. | Service + FAQPage + WebPage (`dateModified`) on every occasion page; BreadcrumbList sitewide |
| 7 | **Visible dates and a refresh cadence.** | Freshness is a retrieval signal, and stale dates suppress citation. | "Written by KC · updated <date>" on each page, `dateModified` in schema, `lastmod` in the sitemap |
| 8 | **Crawlability without JavaScript.** | Most AI crawlers do not run JS. | Static pages generated after `vite build`; robots.txt allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot |
| 9 | **`llms.txt`.** | Google says it does not use it. ChatGPT and Perplexity show small, real effects; it also forces a quotable description. | `dist/llms.txt`, with the canonical description and one line per page |
| 10 | **Hub and spoke internal links.** Each spoke links the parent and at least two siblings with descriptive anchors. | Clarifies relationships for crawlers and models. | Hub `/event-types.html`; each page links two siblings, prices, coverage and FAQ; homepage `Occasions` block; footer lists all of them |
| 11 | **Stated limitations.** Say where the answer does not apply. | Reads as more reliable, to people and to models weighing sources. | "One artist, so she cannot play two rooms at once"; December Fridays gone by October |
| 12 | **E-E-A-T through specifics.** Named venues, real numbers, a byline. | Experience and trust are judged on specifics, not adjectives. | Venue names, price bands, a byline line per page |
| 13 | **Local signals.** One page per real city, NAP consistency, Google Business Profile kept live. | GBP is the biggest local lever; review recency now outweighs raw count. | Manchester page already existed; occasion pages carry the North West travel area |

## What was changed in this pass

- **Six new pages**, one per kind of booking that was not covered: birthdays and
  private parties, corporate and awards nights, Christmas parties, club nights
  and residencies, festivals and brand takeovers, proms and student nights.
- **A hub page** (`/event-types.html`) that lists every occasion with its price
  and a link — the parent the six spokes needed.
- **The homepage** gained an *Occasions* block that names and prices each one,
  and the footer now links all of them.
- **Three new homepage FAQs**, answer-shaped, so the interactive FAQ matches the
  static pages.
- **`llms.txt`** now carries the canonical description, the per-occasion price
  list, what is included, and the limits, in the form a model can quote.
- **`sitemap.xml`** includes every new page; every page has `dateModified`.

## Honest gaps

- **Google Business Profile** is the biggest single local lever and it cannot be
  edited from here: categories, 20+ photos, review replies and service areas all
  need the account.
- **Reviews** are a ranking and trust signal, and the site has three quotes. A
  steady flow of dated reviews (with responses) would do more than any further
  copy change.
- **Backlinks and third-party mentions** are what co-occurrence rewards. Nothing
  here creates them.
- **No transcript or captioned video.** The live vocal moment is the most
  filmable thing about the act and there is no footage on the page yet.
- **One city does not make a local strategy.** Manchester is covered properly;
  Liverpool, Leeds, Preston and Chester would each need a page with its own
  venues and cases before they earn anything.
- **Measurement is unbuilt.** No baseline of the ten buyer questions run across
  two or three engines, so any future claim of improvement is a guess. That is
  the first thing to build next.
