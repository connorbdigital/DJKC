/**
 * The Atlas: every project, process, pathway and blog brief in this Studio,
 * placed in one space you can fly through.
 *
 * The layout is deterministic — the same inputs always put a node in the same
 * place — because a space you cannot learn is a space you cannot use twice.
 * Nothing here imports three.js: this file is geometry and wording, so it can be
 * tested in node and drawn by the canvas, the DOM or a headset.
 */
import { BUILDER_STEPS } from "./processDoc";
import { CAPABILITIES, CATEGORIES, categoryInfo } from "./features";
import { PACKS, resolvePack } from "./packs";
import { BRIEFS } from "./atlasBriefs";
import type { AnythingApp } from "./anythingClient";
import { LINKS, LINK_GROUP_LABEL, TODOS } from "./resources";

export type NodeKind =
  | "project"
  | "capability"
  | "step"
  | "pack"
  | "brief"
  | "site"
  | "app"
  | "todo"
  | "link"
  | "built"
  | "component";
export type District =
  | "library"
  | "projects"
  | "builder"
  | "packs"
  | "content"
  | "gallery"
  | "anything"
  | "shelf"
  | "studio";

export interface AtlasNode {
  id: string;
  kind: NodeKind;
  district: District;
  label: string;
  /** One line, for hover and search results. */
  line: string;
  /** The detail panel: what this is, why it exists. */
  detail: string;
  /** Bullets for the panel — files, manual steps, facts. */
  bullets: string[];
  /** Named lists, for the nodes that have more than a paragraph to say. */
  sections?: { title: string; lines: string[] }[];
  /** Pages you can open: a project's own site, tab by tab. */
  pages?: { label: string; href: string }[];
  /** What is inside an app: the modules anything.com reports. No hrefs — they are parts, not pages. */
  modules?: string[];
  position: [number, number, number];
  /** Node radius, so the renderer and the ray-picker agree. */
  size: number;
  /** Where clicking "open" should go, if anywhere. */
  href?: string;
}

export interface AtlasEdge {
  from: string;
  to: string;
  kind: "installs" | "proves" | "contains";
}

export interface Atlas {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  districts: { id: District; label: string; blurb: string; centre: [number, number, number] }[];
}

const STUDIO_ORIGIN = "https://studio-connorbdigital.vercel.app";
const REPO_DOCS = "https://github.com/connorbdigital/DJKC/blob/main";

/** The three projects this Studio has actually read. */
export const PROJECTS = [
  {
    id: "project-djkc",
    label: "DJKC — the site",
    line: "Kaysie Cork, wedding DJ in Manchester. Booking form, prices, availability.",
    detail:
      "The first project the Studio was built for: a single-page site with a priced enquiry form, a Stripe deposit, a booking desk and static pages generated for search. 66 tests.",
    bullets: ["React + Vite + Tailwind", "api/ on Vercel", "66 tests, 9 static pages generated", "Owner: connorbdigital"],
    href: "https://kaysie.sitebuildup.co.uk/",
    pages: [
      { label: "Home", href: "https://kaysie.sitebuildup.co.uk/" },
      { label: "Prices", href: "https://kaysie.sitebuildup.co.uk/prices.html" },
      { label: "What a DJ costs", href: "https://kaysie.sitebuildup.co.uk/how-much-does-a-dj-cost.html" },
      { label: "Weddings", href: "https://kaysie.sitebuildup.co.uk/wedding-dj.html" },
      { label: "DJ hire Manchester", href: "https://kaysie.sitebuildup.co.uk/dj-hire-manchester.html" },
      { label: "Live dates", href: "https://kaysie.sitebuildup.co.uk/shows.html" },
      { label: "Questions", href: "https://kaysie.sitebuildup.co.uk/faq.html" },
      { label: "Where KC plays", href: "https://kaysie.sitebuildup.co.uk/coverage.html" },
      { label: "About KC", href: "https://kaysie.sitebuildup.co.uk/about.html" },
    ],
  },
  {
    id: "project-studio",
    label: "Studio — the builder",
    line: "Inventory, feature library, agent drafts, pull requests, merge gate.",
    detail:
      "The app you are standing in. Reads GitHub, knows 13 processes on 7 shelves, drafts a change into a branch, opens a PR, runs the checks, and refuses to merge its own work.",
    bullets: ["150 tests", "PROCESSES.md generated from features.ts", "Never merges", "This Atlas is part of it"],
    href: STUDIO_ORIGIN,
    pages: [
      { label: "Projects", href: `${STUDIO_ORIGIN}/#tab=projects` },
      { label: "Packs", href: `${STUDIO_ORIGIN}/#tab=packs` },
      { label: "Feature library", href: `${STUDIO_ORIGIN}/#tab=features` },
      { label: "Search", href: `${STUDIO_ORIGIN}/#tab=search` },
      { label: "Agent", href: `${STUDIO_ORIGIN}/#tab=draft` },
      { label: "Anything", href: `${STUDIO_ORIGIN}/#tab=anything` },
      { label: "Shelf", href: `${STUDIO_ORIGIN}/#tab=resources` },
      { label: "Atlas (3D)", href: `${STUDIO_ORIGIN}/#tab=atlas` },
    ],
  },
  {
    id: "project-commerce",
    label: "Commerce — the shop",
    line: "Hearth & Grain: 32 products, 12 departments, a static build and the commission maths.",
    detail:
      "A storefront framework and a working shop: money as integers, a product validator, a search box that cannot dead-end, 50 generated pages, and the affiliate rates as typed data.",
    bullets: ["119 tests", "npm run site → 50 pages", "Product + Offer + FAQPage schema", "No payment provider, and it says so"],
    href: "https://ecommerce-two-psi-13.vercel.app/",
    pages: [
      { label: "The shop", href: "https://ecommerce-two-psi-13.vercel.app/" },
      { label: "The framework (README)", href: `${REPO_DOCS}/commerce/README.md` },
      { label: "What's missing (GAPS.md)", href: `${REPO_DOCS}/commerce/GAPS.md` },
      { label: "Commission maths", href: `${REPO_DOCS}/commerce/COMMISSION.md` },
      { label: "Where stock comes from", href: `${REPO_DOCS}/commerce/SUPPLIERS.md` },
    ],
  },
] as const;

/** What a page has on it, what it costs to copy, and whether it will be framed. */
export interface SiteRecord {
  id: string;
  label: string;
  url: string;
  kind: string;
  /** One line: what this is. */
  what: string;
  /** What is actually there — pages, parts, counts. Ours are known; theirs are not. */
  built: string[];
  /** What to look at, and what to take from it. */
  look: string[];
  /** Whether the page can be shown inside another site, as far as anyone knows. */
  framing: "opens" | "may refuse";
  /** The supplier-shaped facts: what it gives you, what it asks for, what to check first. */
  supply?: { gives: string; wants: string; check: string };
}

/** Websites you can pull into the gallery and look at from any angle. */
export const SITES: SiteRecord[] = [
  {
    id: "site-sitebuildup",
    label: "sitebuildup.co.uk",
    url: "https://www.sitebuildup.co.uk/",
    kind: "Your site",
    what: "Kaysie Cork's site: a wedding DJ in Manchester, with prices, availability and a booking form that takes a deposit.",
    built: [
      "One page that does the selling: prices, packages, availability, FAQs",
      "An enquiry form priced from the answers, with a Stripe deposit at the end",
      "A booking desk behind it, and a calendar feed for the dates already taken",
      "Static pages generated for search, plus the chat widget",
      "Built on anything.com — so its modules are in the Anything arm of this space",
    ],
    look: [
      "The price before the form: a quote that arrives before someone has to ask for it",
      "The deposit: what percentage, and what it says about a date being held",
      "The wording of the availability answer — the honest part of any booking site",
    ],
    framing: "may refuse",
    supply: {
      gives: "The one page that turns a search into a paid enquiry.",
      wants: "A domain, and the Anything project behind it.",
      check: "Open the Anything tab: the modules listed there are this site's actual pages.",
    },
  },
  {
    id: "site-ecommerce",
    label: "ecommerce-two-psi-13.vercel.app",
    url: "https://ecommerce-two-psi-13.vercel.app/",
    kind: "The demo shop",
    what: "The shop this repository builds: 32 products, twelve departments, and a static catalogue that never needs a server.",
    built: [
      "32 products across 12 departments, with prices as integers",
      "A search box that cannot dead-end, and a department rail on a phone",
      "50 generated pages, 33 placeholder images, a Merchant feed and llms.txt",
      "Product, Offer and FAQPage structured data on every product page",
      "No payment provider, and the checkout says so rather than pretending",
    ],
    look: [
      "Delivery before the click: the cost is on the card, not at the checkout",
      "The staff pick and the spotted-it-cheaper note — trust artefacts, not decoration",
      "The empty state of the search: it suggests departments instead of apologising",
    ],
    framing: "may refuse",
    supply: {
      gives: "A storefront you can lift: the code for it is in commerce/ and installs as one pack.",
      wants: "A product feed and a payment provider — neither is in the repository.",
      check: "commerce/GAPS.md lists what a real shop has that this one does not.",
    },
  },
  {
    id: "site-studio",
    label: "studio-connorbdigital.vercel.app",
    url: "https://studio-connorbdigital.vercel.app/",
    kind: "This space",
    what: "The Studio itself: the inventory, the feature library, the draft → pull request → checks gate, the pitch sheet, and both spaces — the Atlas and the City.",
    built: [
      "Every project, process, pack and draft in one place, with the Atlas and the City over the top of it",
      "A feature library copied out of real code, with the manual steps a PR cannot do",
      "Drafts a change into a branch, opens a pull request, runs the checks, and refuses to merge its own work",
      "A pitch sheet: a URL in, five faults out, the email to send, and a list that remembers who was written to",
    ],
    look: [
      "The gate: a token asked for where it is used, never at the door",
      "The City: a corridor with a room per district, and a project with a room of its own inside",
      "The Anything tab: projects read through the deployment's key, listed and never changed",
    ],
    framing: "opens",
    supply: {
      gives: "The whole working method, running: the library, the gate, the pitch and the spaces.",
      wants: "A GitHub token for the repository tabs, and an Anything key for the Anything tab.",
      check: "Every tab except the repository ones works with no key at all — the shelf, the notes, the Atlas and the City.",
    },
  },
  {
    id: "site-amazon",
    label: "amazon.co.uk",
    url: "https://www.amazon.co.uk/",
    kind: "Reference: scale",
    what: "The catalogue at scale: a search that always answers, and a product page that has been tested on more people than any other.",
    built: [
      "Recommendation rails that survive a catalogue of hundreds of millions",
      "A buy box that answers price, delivery and returns in one block",
      "Reviews as a filter, not a feed",
    ],
    look: [
      "The first screen of a product page: price, delivery date, stock, seller",
      "How little it asks you to read before buying",
    ],
    framing: "may refuse",
  },
  {
    id: "site-argos",
    label: "argos.co.uk",
    url: "https://www.argos.co.uk/",
    kind: "Reference: checkout",
    what: "The British high-street model: reserve now, collect today, and a checkout that knows which store has it.",
    built: [
      "Stock as a promise tied to a postcode",
      "A reservation flow that exists before payment does",
      "Fulfilment options priced next to the product",
    ],
    look: [
      "The collect-today badge and what it does to conversion nerves",
      "The order the checkout asks for details in",
    ],
    framing: "may refuse",
  },
  {
    id: "site-wayfair",
    label: "wayfair.co.uk",
    url: "https://www.wayfair.co.uk/",
    kind: "Reference: catalogue",
    what: "A catalogue where the product is impossible to photograph well, so the filters do the selling.",
    built: [
      "Faceted search with dimensions as first-class filters",
      "Room-set photography that shows scale",
      "Delivery lead times on the card, because furniture is not next-day",
    ],
    look: [
      "The filter rail: what it asks before showing anything",
      "How a 2-metre sofa is described in a 300px card",
    ],
    framing: "may refuse",
  },
  {
    id: "site-ikea",
    label: "ikea.com/gb",
    url: "https://www.ikea.com/gb/en/",
    kind: "Reference: navigation",
    what: "Navigation as the product: a catalogue organised the way a room is, not the way a warehouse is.",
    built: [
      "Rooms, then categories, then products — a hierarchy you can hold in your head",
      "Assembly and dimensions as structured data, not prose",
      "A store stock check that is honest about distance",
    ],
    look: [
      "The department rail and how few words it uses",
      "The dimensions block: the one thing people actually need",
    ],
    framing: "may refuse",
  },
  {
    id: "site-therange",
    label: "therange.co.uk",
    url: "https://www.therange.co.uk/",
    kind: "Reference: taxonomy",
    what: "The discounter's catalogue: thousands of cheap things, arranged so a price-led shopper can find them.",
    built: [
      "Price-band navigation as a first-class way in",
      "Promotions that sit above the taxonomy rather than fighting it",
      "A flat hierarchy, because the shopper is not browsing a category — they are looking for a bargain",
    ],
    look: [
      "How the price filter is offered before the category",
      "The way promotions are labelled so nobody feels tricked",
    ],
    framing: "may refuse",
  },
];

/**
 * What has already shipped, so the space can answer "what is built" as well as
 * "what is next". Each entry is a round that landed: what changed, why, and the
 * pull request that carried it.
 */
export const BUILT = [
  {
    id: "built-studio",
    label: "The Studio",
    line: "Inventory, a feature library, agent drafts, pull requests and a merge gate that will not merge its own work.",
    detail:
      "The app this space lives in. It reads GitHub, knows every process on the shelves, drafts a change into a branch, opens a pull request and runs the checks — and then stops, because the point is review.",
    bullets: ["73 tests when it shipped", "8 tabs, 13 processes", "Never merges, never deploys"],
  },
  {
    id: "built-storefront",
    label: "The storefront framework",
    line: "32 products, 12 departments, prices as integers, and 50 static pages built without a server.",
    detail:
      "`commerce/` builds a shop from a catalogue file: validated products, a search that cannot dead-end, structured data on every page, a Merchant feed, llms.txt and a sitemap. No payment provider, and it says so.",
    bullets: ["119 tests", "npm run site → 50 pages", "Product + Offer + FAQPage schema"],
  },
  {
    id: "built-bookings",
    label: "Priced enquiries and deposits",
    line: "A form that quotes before it asks, takes a deposit through Stripe, and leaves a booking desk behind it.",
    detail:
      "The site's commercial core: answers priced as they are given, a Stripe deposit at the end, a desk where the dates are managed, a calendar feed, and email to whoever needs to know.",
    bullets: ["Stripe deposit at booking", "Desk at /desk", "Calendar feed for taken dates"],
  },
  {
    id: "built-shelf",
    label: "The Shelf",
    line: "What to do next, where everything lives, and every key with the reason it exists — in one tab, offline.",
    detail:
      "Three columns of work with a reason each, 28 sourcing and account links in five groups, and a table of every environment variable the two deployments read with what breaks without it. Copy as Markdown turns the whole thing into a brief.",
    bullets: ["PR #20", "15 tasks, 28 links, 15 keys", "Needs no token and no network"],
  },
  {
    id: "built-github-proxy",
    label: "GitHub, read through the deployment",
    line: "The Studio reads GitHub with a server-held token, so nobody pastes a credential into a browser to look around.",
    detail:
      "`/api/github` is GET-only against an allowlist of paths, with a 12-second timeout and a 4 MB ceiling. Writes still ask for a token at the gate, where the person authorising it can see what they are authorising.",
    bullets: ["PR #21", "GET only, path allowlist", "Gate disappears once GITHUB_TOKEN is set"],
  },
  {
    id: "built-anything-key",
    label: "Anything, read-only",
    line: "Your anything.com projects and their modules, read server-side so the key never reaches the page.",
    detail:
      "An Anything tab that lists projects with credits left, and a route that forwards two list reads and one project's detail — nothing that can create, rename or delete. Anything's Basic auth puts the key in the username, which is exactly why it lives on the server.",
    bullets: ["PR #22", "3 paths, exact", "Missing key ≠ rejected key"],
  },
  {
    id: "built-compass",
    label: "The Atlas as a compass",
    line: "Four arms of equal length, one ring through them, spokes and rim ticks — and your Anything apps on the diagonal.",
    detail:
      "The space stopped being hand-placed: districts sit on measured arms, each district has a ring at the radius its own nodes stand at, and node sizes come from a four-step ladder. Anything's apps joined as suns, each carrying the modules inside it.",
    bullets: ["PR #23", "138 tests", "Every frame derived from the data"],
  },
] as const;

const TAU = Math.PI * 2;
const round = (value: number) => Math.round(value * 100) / 100;

/** Golden-angle sphere: evenly spread without a physics solver or a random seed. */
const spherePoint = (index: number, total: number, radius: number): [number, number, number] => {
  const y = total === 1 ? 0 : 1 - (index / (total - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * 2.399963229728653;
  return [round(Math.cos(theta) * r * radius), round(y * radius * 0.62), round(Math.sin(theta) * r * radius)];
};

const ringPoint = (index: number, total: number, radius: number, height: number, phase = 0): [number, number, number] => {
  const angle = phase + (index / Math.max(1, total)) * TAU;
  return [round(Math.cos(angle) * radius), round(height), round(Math.sin(angle) * radius)];
};

export const DISTRICTS: Atlas["districts"] = [
  { id: "library", label: "The library", blurb: "13 processes on 7 shelves. The centre of the space: everything else refers to it.", centre: [0, 4, 0] },
  { id: "projects", label: "Projects", blurb: "The repositories this Studio has read, and what is in them.", centre: [92, 10, 0] },
  { id: "builder", label: "How the builder works", blurb: "The eight steps between a brief and a pull request.", centre: [-92, 14, 0] },
  { id: "packs", label: "Pathways", blurb: "Four packs: a set of processes that install together, with the routes between them.", centre: [0, 34, -92] },
  { id: "content", label: "The blog plan", blurb: "Every post for sitebuildup.co.uk, with the number it argues from.", centre: [0, 16, 92] },
  { id: "gallery", label: "The gallery", blurb: "Live sites you can fly up to. Some refuse to be framed; the card tells you so.", centre: [0, 30, 310] },
  /* A diagonal, not another axis: the space is a compass, and this is the arm
     that only exists when there is an Anything account to read. */
  {
    id: "shelf",
    label: "The shelf",
    blurb: "What to do next, where everything lives, and what has already shipped.",
    centre: [92, 18, 92],
  },
  {
    id: "anything",
    label: "Anything",
    blurb: "The apps on anything.com: what each one is, what is inside it, and where it publishes.",
    centre: [-92, 20, -92],
  },
  /* The other diagonal: not the work, the instrument. Every piece of the Studio
     you can see and click is a thing, so every piece of it is a star. */
  {
    id: "studio",
    label: "The Studio itself",
    blurb: "Every component of this interface — the header, the tabs, the gate, the cards — each one a star you can open.",
    centre: [92, 20, -92],
  },
];

/**
 * One radius for the four cardinal arms, so a single ring passes through all of
 * them. The space is measured in these numbers, not eyeballed: the east and west
 * arms, the north and south arms, and the diagonal are all the same distance
 * from the library, which is what makes the shape legible from the air.
 */
export const ARM_RADIUS = 92;

/**
 * The space is deliberately small: a bigger one is impressive for ten seconds
 * and tiring for ten minutes. These distances are in "metres" of flight.
 */
export const WORLD_SCALE = 0.62;

/**
 * Four sizes, not six. A node's size says what kind of thing it is and how much
 * of the space it owns: an arm's anchor, a sun with children, a sun, a small sun.
 * Sizes off the ladder read as accidents.
 */
export const SIZE = { small: 2, medium: 2.6, large: 3.4, anchor: 4.4 } as const;

/** A project you add yourself, kept in this browser rather than in the repo. */
export interface CustomProject {
  id: string;
  label: string;
  line: string;
  detail?: string;
  href?: string;
  stack?: string[];
}

export const MAX_CUSTOM_PROJECTS = 24;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function customProjectId(label: string): string {
  const slug = slugify(label) || "project";
  return `project-own-${slug}`;
}

const safeHref = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\/[^\s]+$/i.test(value)) return value;
  return undefined;
};

/**
 * Anything read back from storage is untrusted: it may be from an older build,
 * or typed by someone's extension. Validate it into shape or drop it.
 */
export function parseCustomProjects(raw: unknown): CustomProject[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomProject[] = [];
  for (const entry of raw.slice(0, MAX_CUSTOM_PROJECTS)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
    if (label.length < 2) continue;
    const id = customProjectId(label);
    if (seen.has(id)) continue;
    seen.add(id);
    const line = typeof record.line === "string" ? record.line.trim().slice(0, 200) : "";
    const detail = typeof record.detail === "string" ? record.detail.trim().slice(0, 900) : "";
    const stack = Array.isArray(record.stack)
      ? record.stack.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8)
      : [];
    const href = safeHref(record.href);
    out.push({ id, label, line, ...(detail ? { detail } : {}), ...(href ? { href } : {}), ...(stack.length ? { stack } : {}) });
  }
  return out;
}

export function buildAtlas(custom: CustomProject[] = [], apps: AnythingApp[] = []): Atlas {
  const nodes: AtlasNode[] = [];
  const edges: AtlasEdge[] = [];

  /* ------------------------------------------------------------- library */
  CAPABILITIES.forEach((capability, index) => {
    const shelf = categoryInfo(capability.category);
    nodes.push({
      id: `cap-${capability.id}`,
      kind: "capability",
      district: "library",
      label: capability.name,
      line: capability.summary,
      detail: `${capability.why}\n\nWithout it: ${capability.without}`,
      bullets: [
        `Shelf: ${shelf?.label ?? capability.category}`,
        `Version ${capability.version}`,
        `${capability.files.length} files`,
        `Install after: ${capability.requires.length ? capability.requires.join(", ") : "nothing"}`,
        ...capability.manual.slice(0, 3).map((step) => `By hand: ${step}`),
      ],
      position: spherePoint(index, CAPABILITIES.length, 34),
      size: SIZE.small,
      /* The process has a page of its own, written at build time from the same
         library entry, so a star is also a thing you can read and link to. */
      href: `/process/${capability.id}.html`,
      pages: [
        { label: "Read the process", href: `/process/${capability.id}.html` },
        { label: `Source: ${capability.source}`, href: `https://github.com/${capability.source}` },
      ],
    });
  });

  /* ------------------------------------------------------------ projects */
  PROJECTS.forEach((project, index) => {
    const position = ringPoint(index, PROJECTS.length, 15, 8, 0);
    nodes.push({
      id: project.id,
      kind: "project",
      district: "projects",
      label: project.label,
      line: project.line,
      detail: project.detail,
      bullets: [...project.bullets],
      position: [round(ARM_RADIUS + position[0]), position[1], round(position[2])],
      size: SIZE.anchor,
      href: project.href,
      pages: [...project.pages],
    });
  });

  /* Projects you added yourself stand in a wider ring around the same district,
     so the authored three keep their places and yours are obviously yours. */
  custom.forEach((project, index) => {
    const ring = Math.max(26, 20 + custom.length * 1.4);
    const position = ringPoint(index, Math.max(custom.length, 3), ring, 6, Math.PI / custom.length + 0.4);
    nodes.push({
      id: project.id,
      kind: "project",
      district: "projects",
      label: project.label,
      line: project.line || project.stack?.join(" · ") || "Added to the space by hand.",
      detail: project.detail || `${project.label} was added to the Atlas from this browser. It is not in the repository, so it will not appear on another machine.`,
      bullets: [
        ...(project.stack?.length ? [project.stack.join(" · ")] : []),
        ...(project.href ? [project.href] : []),
        "Added by you · kept in this browser",
      ],
      position: [round(ARM_RADIUS + position[0]), round(8 + position[1]), round(position[2])],
      size: SIZE.anchor,
      ...(project.href ? { href: project.href } : {}),
    });
  });

  /* ------------------------------------------------------------ anything */
  /* Apps stand on the diagonal arm, on a ring of the same radius as the
     library's own, at the foot of the arm — so the arm is one place whether you
     fly at it from the library or arrive from the west. */
  const anythingArm = DISTRICTS.find((district) => district.id === "anything")!;
  /* Apps fill a ring of eight, then a second ring further out: ten apps on one
     circle is a crowd, and a ring you cannot count is not a map. */
  const PER_RING = 8;
  apps.forEach((app, index) => {
    const ring = Math.floor(index / PER_RING);
    const inRing = Math.min(PER_RING, apps.length - ring * PER_RING);
    const position = ringPoint(index % PER_RING, Math.max(inRing, 3), 17 + ring * 11, 0, Math.PI / 4);
    const modules = app.modules.length ? `${app.modules.length} module${app.modules.length === 1 ? "" : "s"}` : "no modules read";
    const where = app.url ? app.url.replace(/^https:\/\//, "").replace(/\/$/, "") : "not published";
    const updated = app.updatedAt ? new Date(app.updatedAt) : null;
    const stamp = updated && !Number.isNaN(updated.getTime())
      ? updated.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "unknown";
    nodes.push({
      id: `app-${app.id}`,
      kind: "app",
      district: "anything",
      label: app.name,
      line: `${app.platform === "both" ? "Web and mobile" : app.platform === "mobile" ? "Mobile" : "Web"} app · ${modules} · ${where}`,
      detail: `${app.name} is built on anything.com, in ${app.organizationName}: ${modules}, last changed ${stamp}. ${
        app.url
          ? `It publishes at ${app.url}, so the card opens the running app rather than a description of it.`
          : "It has never been published, so there is nothing to open yet."
      }\n\nRead through this deployment's key: the Atlas can see what is inside the app, and cannot change any of it.`,
      bullets: [
        `Platform: ${app.platform}`,
        /* The parts have their own list in the panel; the bullet says the size
           of it, not the first twelve names of it. */
        modules ? `${app.moduleCount ?? app.modules.length} parts, listed below` : "Nothing read from inside it yet",
        ...(app.url ? [app.url] : []),
        `Last changed ${stamp}`,
      ],
      position: [round(anythingArm.centre[0] + position[0]), round(anythingArm.centre[1] + position[1]), round(anythingArm.centre[2] + position[2])],
      size: SIZE.large,
      ...(app.modules.length ? { modules: app.modules } : {}),
      ...(app.url ? { href: app.url } : {}),
    });
  });

  /* ------------------------------------------------------------- studio */
  /* The instrument, on the other diagonal. Small suns on a ring, each with the
     file that builds it: the space is now a map of the thing it is drawn by. */
  const studioArm = DISTRICTS.find((district) => district.id === "studio")!;
  STUDIO_COMPONENTS.forEach((component, index) => {
    const position = ringPoint(index, Math.max(STUDIO_COMPONENTS.length, 3), 15, 0, -Math.PI / 4);
    nodes.push({
      id: `ui-${component.id}`,
      kind: "component",
      district: "studio",
      label: component.label,
      line: component.line,
      detail: component.detail,
      bullets: component.bullets,
      position: [
        round(studioArm.centre[0] + position[0]),
        round(studioArm.centre[1] + position[1]),
        round(studioArm.centre[2] + position[2]),
      ],
      size: SIZE.medium,
      href: `https://github.com/connorbdigital/DJKC/blob/main/${component.file}`,
      /* Its own room, with the two links that matter: the file that builds it,
         and the Studio it is drawn by. A component is only a description until
         you can open it. */
      pages: [
        { label: "The file on GitHub", href: `https://github.com/connorbdigital/DJKC/blob/main/${component.file}` },
        { label: "The Studio itself", href: "https://studio-connorbdigital.vercel.app" },
      ],
    });
  });

  /* --------------------------------------------------------------- shelf */
  /* Five rings, smallest first: what has shipped sits at the middle because it
     is the ground you stand on; the work waiting on you wraps around it; the
     links are the outermost ring, because they are reference, not tasks. */
  const shelfArm = DISTRICTS.find((district) => district.id === "shelf")!;
  BUILT.forEach((entry, index) => {
    const position = ringPoint(index, BUILT.length, 14, 0, Math.PI / 6);
    nodes.push({
      id: entry.id,
      kind: "built",
      district: "shelf",
      label: entry.label,
      line: entry.line,
      detail: entry.detail,
      bullets: [...entry.bullets],
      position: [round(shelfArm.centre[0] + position[0]), round(shelfArm.centre[1] + 4 + position[1]), round(shelfArm.centre[2] + position[2])],
      size: SIZE.medium,
    });
  });

  const TODO_RINGS: Record<string, { radius: number; keys: string }> = {
    now: { radius: 23, keys: "now" },
    next: { radius: 30, keys: "next" },
    later: { radius: 37, keys: "later" },
  };
  (["now", "next", "later"] as const).forEach((state) => {
    const ring = TODO_RINGS[state]!;
    const items = TODOS.filter((todo) => todo.state === state);
    items.forEach((todo, index) => {
      const position = ringPoint(index, items.length, ring.radius, 0, 0.2);
      nodes.push({
        id: `todo-${todo.id}`,
        kind: "todo",
        district: "shelf",
        label: todo.title,
        line: todo.why,
        detail: `${todo.why}\n\nEffort: ${todo.effort === "S" ? "a day" : todo.effort === "M" ? "about a week" : "a month or more"}. Part of the project: ${todo.where}. It sits under ${state === "now" ? "Now: it costs money or blocks everything else" : state === "next" ? "Next: worth doing once the blocking work is clear" : "Later: real, not yet urgent"}.`,
        bullets: [`${state.toUpperCase()} · effort ${todo.effort}`, `Area: ${todo.where}`, todo.why],
        position: [round(shelfArm.centre[0] + position[0]), round(shelfArm.centre[1] + 2 + position[1]), round(shelfArm.centre[2] + position[2])],
        size: SIZE.small,
      });
    });
  });

  /* The links keep their groups: each group is a contiguous arc, in the order
     the Shelf prints them, so the ring reads the way the page does. */
  LINKS.forEach((entry, index) => {
    const position = ringPoint(index, LINKS.length, 48, 0, Math.PI / 2);
    nodes.push({
      id: `link-${slugify(entry.label)}`,
      kind: "link",
      district: "shelf",
      label: entry.label,
      line: entry.note,
      detail: `${entry.note}\n\nGroup: ${LINK_GROUP_LABEL[entry.group]}. ${entry.href}`,
      bullets: [LINK_GROUP_LABEL[entry.group], entry.href],
      position: [round(shelfArm.centre[0] + position[0]), round(shelfArm.centre[1] + position[1]), round(shelfArm.centre[2] + position[2])],
      size: SIZE.small,
      href: entry.href,
    });
  });

  /* ------------------------------------------------------------- builder */
  BUILDER_STEPS.forEach((step, index) => {
    const position = ringPoint(index, BUILDER_STEPS.length, 13, 0, Math.PI);
    nodes.push({
      id: `step-${index + 1}`,
      kind: "step",
      district: "builder",
      label: `${index + 1}. ${step.name}`,
      line: step.does,
      detail: `${step.does}\n\nWhy: ${step.why}`,
      bullets: [],
      position: [round(-92 + position[0]), round(14 + Math.sin(index * 1.1) * 5), round(position[2])],
      size: SIZE.small,
    });
    if (index > 0) edges.push({ from: `step-${index}`, to: `step-${index + 1}`, kind: "contains" });
  });

  /* --------------------------------------------------------------- packs */
  PACKS.forEach((pack, index) => {
    const position = ringPoint(index, PACKS.length, 18, 0, Math.PI / 4);
    const members = resolvePack(pack);
    nodes.push({
      id: `pack-${pack.id}`,
      kind: "pack",
      district: "packs",
      label: pack.name,
      line: pack.summary,
      detail: `A pathway through the library: ${members.length} processes that install together in one pull request.\n\nInstalls: ${members.map(
        (member) => member.name
      ).join(", ")}.\n\nBefore you start:\n${pack.before
        .map((item) => `• ${item}`)
        .join("\n")}`,
      bullets: [`${members.length} processes`, `Files written: ${members.reduce((total, member) => total + member.files.length, 0)}`, ...pack.before.map((item) => `Before: ${item}`)],
      position: [round(position[0]), round(34 + position[1]), round(-ARM_RADIUS + position[2])],
      size: SIZE.large,
    });
    for (const member of members) edges.push({ from: `pack-${pack.id}`, to: `cap-${member.id}`, kind: "installs" });
  });

  /* ------------------------------------------------------------- content */
  /* The blog plan is a wall rather than a ring: fourteen posts read as a
     content calendar, two rows of seven, curved slightly so the edges face you. */
  const COLUMNS = 7;
  BRIEFS.forEach((brief, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    /* Spacing is the card's own width plus a gap, not a guess: at 14 apart the
     wall reads as fourteen posts instead of one bright smear. */
    const position: [number, number, number] = [(column - (COLUMNS - 1) / 2) * 14, 10 + row * 13, 92 + Math.pow(column - 3, 2) * 1.1];
    const short = brief.title.split(/[:—]/)[0]!.trim().split(" ").slice(0, 7).join(" ");
    nodes.push({
      id: `brief-${brief.slug}`,
      kind: "brief",
      district: "content",
      label: short,
      line: brief.title,
      detail: `${brief.title}\n\n${brief.promise}\n\nTarget query: ${brief.query}\nAudience: ${brief.audience}\nService: ${brief.service}\n\n${brief.outline.map((heading) => `• ${heading}`).join("\n")}`,
      bullets: [
        `${brief.words} words · ${brief.status}`,
        ...brief.facts.map((fact) => `${fact.point} (${fact.evidence})`),
        ...brief.proof.map((file) => `Proof: ${file}`),
      ],
      position: [round(position[0]), round(position[1]), round(position[2])],
      size: SIZE.medium,
    });
    edges.push({ from: `brief-${brief.slug}`, to: `cap-${brief.capability}`, kind: "proves" });
  });

  /* ------------------------------------------------------------- gallery */
  /* A filmstrip, not a ring: seven screens in a row, spaced so the panels
     (10.8 world units wide) sit side by side with a small gap, facing the way
     you arrive. */
  SITES.forEach((site, index) => {
    const position: [number, number, number] = [(index - (SITES.length - 1) / 2) * 19, 0, 310];
    nodes.push({
      id: site.id,
      kind: "site",
      district: "gallery",
      label: site.label,
      line: `${site.kind} — ${site.what}`,
      detail: `${site.what}\n\nClicking this opens the page here, in a panel you can scroll.${
        site.framing === "may refuse"
          ? " If it refuses to be framed the panel says so, and the tab link is still the way in."
          : ""
      }`,
      bullets: [site.url, site.kind],
      sections: [
        { title: "What is there", lines: site.built },
        { title: "What to look at", lines: site.look },
        ...(site.supply
          ? [
              {
                title: "The supplier view",
                lines: [`Gives you: ${site.supply.gives}`, `Asks for: ${site.supply.wants}`, `Check first: ${site.supply.check}`],
              },
            ]
          : []),
      ],
      position: [round(position[0]), round(30 + position[1]), round(position[2])],
      size: SIZE.large,
      href: site.url,
    });
  });

  for (const node of nodes) {
    node.position = [round(node.position[0] * WORLD_SCALE), round(node.position[1] * WORLD_SCALE), round(node.position[2] * WORLD_SCALE)];
  }
  const districts = DISTRICTS.filter((district) => district.id !== "anything" || apps.length > 0).map((district) => ({
    ...district,
    centre: [round(district.centre[0] * WORLD_SCALE), round(district.centre[1] * WORLD_SCALE), round(district.centre[2] * WORLD_SCALE)] as [number, number, number],
  }));

  return { nodes, edges, districts };
}

/** Case-insensitive, order-independent, and forgiving of a missing word. */
export function searchAtlas(atlas: Atlas, query: string, limit = 12): AtlasNode[] {
  const words = query.toLowerCase().split(/[^a-z0-9.]+/).filter((word) => word.length > 1);
  if (!words.length) return [];
  const scored = atlas.nodes.map((node) => {
    /* Field by field: a hit in the title outranks the summary, and the summary
       outranks a passing mention in the body. "Affiliate" must open the post
       about commission, not the shop that mentions it once in its detail. */
    const fields: [string, number][] = [
      [node.label, 8],
      [node.line, 5],
      [node.bullets.join(" "), 3],
      [node.detail, 1.5],
    ].map(([text, weight]) => [String(text).toLowerCase(), weight as number]);
    let score = 0;
    let matched = 0;
    for (const word of words) {
      const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      const hit = fields.find(([text]) => pattern.test(text)) ?? fields.find(([text]) => text.includes(word));
      if (!hit) continue;
      score += hit[1];
      matched++;
    }
    return { node, score: matched ? score + matched : 0 };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.node);
}

/** Fly to the thing the query means, if it means anything. */
export function bestMatch(atlas: Atlas, query: string): AtlasNode | null {
  return searchAtlas(atlas, query, 1)[0] ?? null;
}

/** Straight-line distance, used by the HUD to say how far a jump is. */
export const distance = (a: [number, number, number], b: [number, number, number]) =>
  Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));

export const kindColour: Record<NodeKind, string> = {
  component: "#38bdf8",
  project: "#8c5bff",
  app: "#f472b6",
  todo: "#a3e635",
  link: "#94a3b8",
  built: "#c084fc",
  capability: "#ff2bd6",
  step: "#6ee7b7",
  pack: "#ffd166",
  brief: "#7dd3fc",
  site: "#fb923c",
};

export const shelfOf = (capabilityId: string) => {
  const capability = CAPABILITIES.find((entry) => entry.id === capabilityId);
  return capability ? categoryInfo(capability.category)?.label ?? capability.category : "unknown";
};

export const CATEGORY_LABELS = CATEGORIES.map((entry) => entry.label);

export function nearestDistrict(atlas: Atlas, point: [number, number, number]): District {
  let best: District = "library";
  let distance = Infinity;
  for (const district of atlas.districts) {
    const d = Math.hypot(point[0] - district.centre[0], point[2] - district.centre[2]);
    if (d < distance) {
      distance = d;
      best = district.id;
    }
  }
  return best;
}

export function nearestNode(atlas: Atlas, point: [number, number, number]) {
  let best: { node: AtlasNode; distance: number } | null = null;
  for (const node of atlas.nodes) {
    const d = Math.hypot(point[0] - node.position[0], point[1] - node.position[1], point[2] - node.position[2]);
    if (!best || d < best.distance) best = { node, distance: d };
  }
  return best;
}

export const compass = (yaw: number) => {
  const degrees = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360;
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8]!;
};


/* --------------------------------------------------------------- journeys */

/**
 * A tour is the shortest honest answer to "what is this place": six stops, one
 * per district, each with a sentence you can read while the camera is moving.
 */
export interface TourStop {
  district: District;
  caption: string;
  /** Optional node to end on, so a stop can be more than a district centre. */
  node?: string;
}

export const TOUR: TourStop[] = [
  { district: "library", caption: "Thirteen processes we can install, each one something that has already shipped." },
  { district: "packs", caption: "Four pathways: several processes, resolved in dependency order, opened as one pull request." },
  { district: "builder", caption: "The eight steps every build goes through — the reasons, not just the tasks." },
  { district: "projects", caption: "The work itself: this site, the shop, and the build behind them." },
  { district: "content", caption: "Fourteen posts for sitebuildup.co.uk, each arguing from a number we can show.", node: "brief-checkout-losing-money" },
  { district: "gallery", caption: "Live sites as panels you can fly up to and open, when they allow being framed." },
];

/** `#atlas/<node id>` opens the space already looking at that node. */
export function hashForNode(id: string): string {
  return `#atlas/${id}`;
}

export function nodeFromHash(hash: string, atlas: Atlas): AtlasNode | null {
  const cleaned = hash.replace(/^#/, "").trim();
  if (!cleaned) return null;
  const id = cleaned.startsWith("atlas/") ? cleaned.slice("atlas/".length) : cleaned;
  return atlas.nodes.find((node) => node.id === id) ?? null;
}

/**
 * Portrait phones have a very narrow horizontal field of view at the desktop
 * vertical FOV, which makes the whole space read as a speck. Widen vertically
 * as the aspect ratio narrows, but stop before the projection turns to jelly.
 */
export function responsiveFov(aspect: number, base = 62, max = 86): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return base;
  if (aspect >= 1.4) return base;
  const horizontal = 2 * Math.atan(Math.tan((base * Math.PI) / 360) * 1.4);
  const fitted = (2 * Math.atan(Math.tan(horizontal / 2) / aspect) * 180) / Math.PI;
  return Math.min(max, Math.max(base, fitted));
}

/* ------------------------------------------------------------------ audit */

export type AuditSeverity = "high" | "medium" | "low";

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  title: string;
  detail: string;
  /** The node the finding is about, so the HUD can fly you to it. */
  node?: string;
}

export interface AuditOptions {
  /** Supply `fs.existsSync` outside the browser to check that proofs exist. */
  exists?: (path: string) => boolean;
}

/**
 * What can be checked about the space from the data alone. Deliberately
 * mechanical: every finding is something you can act on, and the audit never
 * invents a score.
 */
export function auditAtlas(atlas: Atlas, options: AuditOptions = {}): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const push = (finding: AuditFinding) => findings.push(finding);

  const ids = new Set<string>();
  for (const node of atlas.nodes) {
    if (ids.has(node.id)) {
      push({ id: `dup-id-${node.id}`, severity: "high", title: "Duplicate node id", detail: `${node.label} shares its id with another node, so a deep link cannot tell them apart.`, node: node.id });
    }
    ids.add(node.id);

    if (node.detail.trim().length < 60) {
      push({ id: `thin-${node.id}`, severity: "low", title: "Thin description", detail: `${node.label} explains itself in ${node.detail.trim().length} characters. A node you cannot understand from the card is a node you will not use.`, node: node.id });
    }
    if (Math.abs(node.position[0]) > 200 || Math.abs(node.position[2]) > 200) {
      push({ id: `bounds-${node.id}`, severity: "high", title: "Outside the space", detail: `${node.label} sits at ${node.position.join(", ")}, beyond the 300-unit flight bound, so you cannot reach it.`, node: node.id });
    }
    if (node.kind === "project" && node.bullets.length < 2) {
      push({ id: `bare-project-${node.id}`, severity: "medium", title: "Project with no evidence", detail: `${node.label} has ${node.bullets.length} bullet${node.bullets.length === 1 ? "" : "s"}. A project in this space is meant to say what is in it.`, node: node.id });
    }
  }

  const labels = new Map<string, string[]>();
  for (const node of atlas.nodes) {
    labels.set(node.label.toLowerCase(), [...(labels.get(node.label.toLowerCase()) ?? []), node.id]);
  }
  for (const [label, owners] of labels) {
    if (owners.length > 1) {
      push({ id: `dup-label-${slugify(label)}`, severity: "medium", title: "Two nodes with the same name", detail: `${owners.length} nodes are called “${label}”, which makes search ambiguous.`, node: owners[1] });
    }
  }

  for (const edge of atlas.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      push({ id: `dangling-${edge.from}-${edge.to}`, severity: "high", title: "Edge to nowhere", detail: `A ${edge.kind} link points at ${ids.has(edge.from) ? edge.to : edge.from}, which is not in the space.` });
    }
  }

  /* Inventory nobody can reach: a process no pack installs and no post explains. */
  const mentioned = new Set<string>();
  for (const edge of atlas.edges) {
    if (edge.to.startsWith("cap-")) mentioned.add(edge.to);
    if (edge.from.startsWith("cap-")) mentioned.add(edge.from);
  }
  for (const node of atlas.nodes) {
    if (node.kind === "capability" && !mentioned.has(node.id)) {
      push({ id: `orphan-${node.id}`, severity: "low", title: "Process nothing points at", detail: `${node.label} is in the library but no pathway installs it and no post cites it. Either wireit up or say why it stands alone.`.replace("wireit", "wire it"), node: node.id });
    }
  }

  for (const district of atlas.districts) {
    if (!atlas.nodes.some((node) => node.district === district.id)) {
      push({ id: `empty-${district.id}`, severity: "medium", title: "Empty district", detail: `${district.label} has no nodes, so the space has a room with nothing in it.` });
    }
  }

  /* Briefs are the argument layer: weak facts here are weak claims out loud. */
  for (const brief of BRIEFS) {
    if (brief.facts.length < 2) {
      push({ id: `facts-${brief.slug}`, severity: "medium", title: "Thin evidence", detail: `“${brief.title}” rests on ${brief.facts.length} fact${brief.facts.length === 1 ? "" : "s"}. Two is the floor for a post that argues from numbers.`, node: `brief-${brief.slug}` });
    }
    for (const fact of brief.facts) {
      if (fact.evidence.trim().length < 8) {
        push({ id: `evidence-${brief.slug}-${slugify(fact.point).slice(0, 24)}`, severity: "medium", title: "Fact with no source", detail: `In “${brief.title}”: “${fact.point}” has the evidence “${fact.evidence}”. That is not a source.`, node: `brief-${brief.slug}` });
      }
    }
    if (options.exists) {
      for (const proof of brief.proof) {
        if (!options.exists(proof)) {
          push({ id: `proof-${brief.slug}-${slugify(proof)}`, severity: "high", title: "Proof file is missing", detail: `“${brief.title}” cites ${proof}, which is not in the repository.`, node: `brief-${brief.slug}` });
        }
      }
    }
  }

  /* Ordered worst first, then by what it is about, so the list reads. */
  const rank: Record<AuditSeverity, number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
}

/* ------------------------------------------------------- the instrument */

/**
 * Every component of the Studio, as data.
 *
 * The Atlas was a map of the work; this is a map of the thing you are looking
 * it through. Each entry is a piece of the interface that is literally on the
 * screen — the header, the tabs, the gate, the cards — with the file that
 * builds it, so "where does that come from?" is one click.
 */
export const STUDIO_COMPONENTS: {
  id: string;
  label: string;
  line: string;
  detail: string;
  bullets: string[];
  file: string;
}[] = [
  {
    id: "header",
    label: "The header",
    line: "Title, ⌘K, Enter the City, Lock — the row that never scrolls away.",
    detail:
      "The top of the Studio: what this is, the way into the two spaces, the palette, and the lock. It is one component on every tab, so the shape of the app is the same wherever you are.",
    bullets: ["studio/src/App.tsx", "One row, three groups", "Holds the door to the Atlas and the City"],
    file: "studio/src/App.tsx",
  },
  {
    id: "tabs",
    label: "The tab row",
    line: "Projects, Packs, Feature library, Search, Agent, Standards, Pitch sheet, Anything, Shelf, City, Atlas (3D).",
    detail:
      "Eleven tabs in three groups: build, ask and read, look around. The grouping is the point — a row of eleven names is a row, not a way around.",
    bullets: ["studio/src/App.tsx", "Grouped: build / ask / look", "Every tab is a hash link"],
    file: "studio/src/App.tsx",
  },
  {
    id: "gate",
    label: "The gate",
    line: "The front door: a token, or the two spaces without one.",
    detail:
      "Asked for a GitHub token once, in the tab, and kept in sessionStorage. The Atlas and the City do not need it; the repository tabs ask when you reach them, and only there.",
    bullets: ["studio/src/components/Gate.tsx", "Enter the Atlas → / Walk the City →", "Token in sessionStorage, never a cookie"],
    file: "studio/src/components/Gate.tsx",
  },
  {
    id: "palette",
    label: "The palette",
    line: "⌘K: every project, pack, process, brief and site, one key away.",
    detail:
      "A command palette over everything the space knows. It exists because the tabs are eleven and the things are hundred-and-fifty: the keyboard has to be faster than the mouse.",
    bullets: ["studio/src/components/Palette.tsx", "⌘K or Ctrl-K", "Search over the whole inventory"],
    file: "studio/src/components/Palette.tsx",
  },
  {
    id: "stars-sheet",
    label: "✷ Stars",
    line: "Every project as a list, with Fly and Go in.",
    detail:
      "The list is the index and the space is the map: Stars names each project, its page count and its address, and flies the camera to it. It exists because a constellation you have to hunt through is a wall.",
    bullets: ["studio/src/components/Atlas.tsx", "Fly moves the camera, Go in opens the room", "#stars is a link straight to it"],
    file: "studio/src/components/Atlas.tsx",
  },
  {
    id: "detail-card",
    label: "The detail card",
    line: "Select anything and it says what it is, in the space, on a board you can read.",
    detail:
      "The card is a surface in the world, not a drawer over it: it hangs beside the node you chose, faces you, and scrolls like a page. The panel in the corner keeps the buttons and your own note.",
    bullets: ["studio/src/components/Atlas.tsx", "studio/src/atlasEngine.ts", "Scroll inside it, wheel to zoom out"],
    file: "studio/src/components/Atlas.tsx",
  },
  {
    id: "project-space",
    label: "A project's own space",
    line: "The front page in the middle, every page on a ring, links read off the pages.",
    detail:
      "Open a project and the space becomes that project: a circle per page, a line per link, and nothing drawn that was not read from the site itself. An Anything app puts its modules on the same ring.",
    bullets: ["studio/src/components/ProjectSpace.tsx", "studio/src/atlasSpace.ts", "Streams read via POST /api/site {links:true}"],
    file: "studio/src/components/ProjectSpace.tsx",
  },
  {
    id: "city-bar",
    label: "The City's bar",
    line: "Where you are, a chip per room, and the way back to the Atlas.",
    detail:
      "The City is walked, not flown, so its head is a directory: the room you are standing in, every room with its count, and the two doors out. Click a chip and you are in that room.",
    bullets: ["studio/src/components/City.tsx", "studio/src/city.ts", "Rooms are data: walls, doors, slots"],
    file: "studio/src/components/City.tsx",
  },
  {
    id: "notepad",
    label: "The notepad",
    line: "A scratchpad in the Atlas, kept in this browser, exported as Markdown.",
    detail:
      "Notes belong to the person reading, not to the repository, so they live in local storage with Copy and Download .md. The pinned note on a node is the same idea at a smaller scale.",
    bullets: ["studio/src/components/Atlas.tsx", "atlas:notes:v1", "Across devices: a gist on your own account"],
    file: "studio/src/components/Atlas.tsx",
  },
  {
    id: "fullscreen",
    label: "Full screen",
    line: "The space without the browser's furniture.",
    detail:
      "One button, the Fullscreen API, and an Escape that still works. It matters because a constellation read through two toolbars is a constellation half seen.",
    bullets: ["studio/src/components/Atlas.tsx", "Fullscreen API", "Escape restores"],
    file: "studio/src/components/Atlas.tsx",
  },
  {
    id: "pitch-sheet",
    label: "The pitch sheet",
    line: "A URL in, five faults out, an email, and a list that remembers.",
    detail:
      "The sales instrument: read a public page, name five faults with what each one costs, draft the email and keep the prospect list. The list is the part that makes it a process rather than a demo.",
    bullets: ["studio/src/components/PitchSheet.tsx", "studio/src/pitch.ts", "Prospects persist between visits"],
    file: "studio/src/components/PitchSheet.tsx",
  },
  {
    id: "standards",
    label: "The Standards board",
    line: "The house rules, and which of them the code actually keeps.",
    detail:
      "A board of the decisions this project made — no invented links, honest empty states, a gate that explains itself — each one pointing at where it is enforced.",
    bullets: ["studio/src/components/Standards.tsx", "studio/src/standards.ts", "Rules are checked in tests where they can be"],
    file: "studio/src/components/Standards.tsx",
  },
  {
    id: "anything-tab",
    label: "The Anything tab",
    line: "Every app on anything.com, with its parts, read and never changed.",
    detail:
      "A read-only view of the Anything account through this deployment's key: the projects, what is inside each one, and Copy the scan — which is how the inventory leaves a deployment whose key cannot be read back.",
    bullets: ["studio/src/components/Anything.tsx", "studio/src/anythingClient.ts", "api/anything.ts is the bridge"],
    file: "studio/src/components/Anything.tsx",
  },
  {
    id: "feel-row",
    label: "The feel row",
    line: "Four looks, a speed switch, and a turbo button that latches.",
    detail:
      "Nebula, Observatory, Blueprint and City: the same data, four ways of lighting it. The look is remembered on the device, because a space you have to restyle every visit is a space you stop visiting.",
    bullets: ["studio/src/components/Atlas.tsx", "studio/src/atlasEngine.ts", "atlas:feel:v2"],
    file: "studio/src/atlasEngine.ts",
  },
  {
    id: "site-panels",
    label: "The site panels",
    line: "A live page hanging in the space, in CSS3D, with a link out if it refuses framing.",
    detail:
      "Each site in the gallery is a panel in three dimensions holding a real iframe. Most big sites refuse to be framed; the panel says so and the link is the way in, rather than a blank rectangle with no explanation.",
    bullets: ["studio/src/atlasEngine.ts", "CSS3DRenderer", "api/site ?thumb= for the link card"],
    file: "studio/src/atlasEngine.ts",
  },
  {
    id: "search",
    label: "Search",
    line: "One box over every star, ranking a title match above a passing mention.",
    detail:
      "Search pulses its matches in the world instead of listing them in a column: the answer to \"where is that?\" is a place, so the result is a place.",
    bullets: ["studio/src/components/Atlas.tsx", "studio/src/atlas.ts searchAtlas", "Matches glow in situ"],
    file: "studio/src/atlas.ts",
  },
];
