/**
 * What every site should have, worked out from the sites we have.
 *
 * The question this answers: given everything the Studio knows — three authored
 * projects and their pages, the Anything apps and their modules, the Studio's own
 * parts, the thirteen processes — what does a site *need*, and which of those
 * needs does a given site actually meet?
 *
 * Two rules, both of them about not inventing anything:
 *
 *  1. **A function is evidence, not opinion.** The universal list is built by
 *     classifying the pages and parts that exist and counting which functions show
 *     up in more than one source. Nothing is put on the list because a checklist
 *     somewhere said a site should have one.
 *  2. **An audit says what it read.** A page that would not be fetched is not a
 *     missing function, it is an unknown one, and it is reported as such rather
 *     than counted against the site.
 *
 * The classifier is deliberately small and Chinese-wall simple: a list of words
 * for each function, matched against a page's name and address. A cleverer
 * classifier would be a cleverer way to be wrong in public.
 */

export type FunctionId =
  | "navigation"
  | "home"
  | "pricing"
  | "booking"
  | "questions"
  | "about"
  | "availability"
  | "work"
  | "coverage"
  | "proof"
  | "legal"
  | "journal"
  | "account"
  | "search"
  | "sitemap";

export interface SiteFunction {
  id: FunctionId;
  label: string;
  /** What a page of this kind is for, in one line. */
  why: string;
  /** Words that, found in a page's name or address, mean this function. */
  words: string[];
  /** An address ending exactly like one of these is a page of this kind. */
  addresses?: string[];
}

/** In the order a site is usually built, which is also the order of the report. */
export const FUNCTIONS: SiteFunction[] = [
  {
    id: "navigation",
    label: "Navigation",
    why: "A way from any page to the pages that matter.",
    words: ["nav", "menu", "header", "tabs"],
  },
  {
    id: "home",
    label: "Front page",
    why: "One screen that says who this is for and what it costs to find out.",
    words: ["home", "front", "index", "landing"],
    addresses: ["", "/", "/index.html", "/index"],
  },
  {
    id: "work",
    label: "The work itself",
    why: "Pictures of the thing being sold, because a description is not evidence.",
    words: ["work", "gallery", "portfolio", "photos", "case", "projects", "weddings", "pictures", "showreel"],
  },
  {
    id: "pricing",
    label: "Prices",
    why: "A number, or a range, before anyone has to ask for it.",
    words: ["price", "pricing", "prices", "cost", "costs", "rates", "packages", "package", "quote", "fees", "how-much"],
  },
  {
    id: "availability",
    label: "Availability",
    why: "Whether the date they want is still free.",
    words: ["availability", "dates", "calendar", "shows", "diary", "booked", "free"],
  },
  {
    id: "booking",
    label: "Booking or enquiry",
    why: "The form that takes the money or the date, priced before the click.",
    words: ["book", "booking", "enquire", "enquiry", "contact", "deposit", "checkout", "reserve", "hold", "get-in-touch", "hire"],
  },
  {
    id: "questions",
    label: "Questions",
    why: "The six things everyone asks, answered on one page.",
    words: ["faq", "faqs", "questions", "help", "answers", "support"],
  },
  {
    id: "about",
    label: "Who you are",
    why: "The person behind it, in their own words.",
    words: ["about", "story", "meet", "team", "who", "bio", "kc"],
  },
  {
    id: "proof",
    label: "Proof",
    why: "Other people saying it worked, with names on it.",
    words: ["reviews", "review", "testimonials", "testimonial", "praise", "feedback", "clients", "kind-words"],
  },
  {
    id: "coverage",
    label: "Where you'll go",
    why: "The area covered, said plainly, so nobody has to ask.",
    words: ["coverage", "areas", "locations", "where", "travel", "map", "venues"],
  },
  {
    id: "journal",
    label: "Writing",
    why: "Pages that answer the questions people type into a search box.",
    words: ["blog", "journal", "news", "guides", "articles", "posts", "notes", "how-to"],
  },
  {
    id: "legal",
    label: "The small print",
    why: "Privacy, terms and refunds — the pages nobody reads until they matter.",
    words: ["privacy", "terms", "cookies", "refund", "legal", "gdpr", "policy"],
  },
  {
    id: "account",
    label: "Sign in",
    why: "A way back in for anyone who has bought something.",
    words: ["login", "log-in", "signin", "sign-in", "account", "admin", "dashboard", "portal"],
  },
  {
    id: "search",
    label: "Search",
    why: "A way to find the page you half remember.",
    words: ["search", "find", "browse"],
  },
  {
    id: "sitemap",
    label: "A map of the site",
    why: "Every page in one place, for people and for crawlers.",
    words: ["sitemap", "sitemap.xml", "all-pages", "index-of"],
  },
];

const BY_ID = new Map(FUNCTIONS.map((entry) => [entry.id, entry]));

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    /* The fragment is kept and the query is not: `/#booking` is a booking link,
       while `?utm_source=x` is noise about where a person came from. */
    .replace(/\?.*$/, "")
    .replace(/[^a-z0-9./-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/$/, "");

/**
 * Which function a page belongs to. The name is tried before the address, because
 * a page called "Prices" at `/p.html` is a price page, while an address saying
 * `prices` is the other way round. Ambiguity resolves to the more specific word —
 * `wedding-dj` is work, `book-a-wedding` is booking — by scoring the words rather
 * than taking the first hit.
 */
export function classifyPage(label: string, href = ""): FunctionId | null {
  const name = normalise(label).replace(/^\/+|\/+$/g, "");
  const path = normalise(href);
  const bare = path.replace(/^[^/]*\//, "").replace(/\.(html?|php|aspx?)$/, "");

  let best: { id: FunctionId; score: number } | null = null;
  for (const entry of FUNCTIONS) {
    let score = 0;
    for (const word of entry.words) {
      if (name === word || name.replace(/[-_ ]/g, "") === word.replace(/[-_]/g, "")) score = Math.max(score, 3);
      else if (name.includes(word)) score = Math.max(score, 2);
      if (bare === word) score = Math.max(score, 2.5);
      else if (bare.includes(word)) score = Math.max(score, 1.5);
    }
    for (const address of entry.addresses ?? []) {
      const wanted = address.replace(/^\//, "").replace(/^.*\//, "");
      if (bare && bare === wanted) score = Math.max(score, 2.5);
    }
    if (score > 0 && (!best || score > best.score)) best = { id: entry.id, score };
  }
  if (best) return best.id;

  /* A link with no name at all, pointing at a site's front door, is the front
     door. An empty address is not a front door, it is an absence. Everything else
     is honestly nothing. */
  const looksLikeRoot = href === "/" || /^https?:\/\/[^/]+\/?$/.test(href);
  return looksLikeRoot ? "home" : null;
}

export interface SourceItem {
  label: string;
  href?: string;
}

export interface Source {
  id: string;
  label: string;
  kind: "site" | "app" | "studio" | "process" | "pack";
  items: SourceItem[];
}

export interface UniversalEntry {
  id: FunctionId;
  label: string;
  why: string;
  /** The sources that have a page of this kind. */
  have: string[];
  /** The sources that do not. */
  lack: string[];
  /** How many pages and parts fall into this function, across every source. */
  coverage: number;
  /** How many distinct sources have at least one of them. */
  sourceCount: number;
  /** True when every source with any pages at all has it. */
  everywhere: boolean;
  /** A page the function was found on, to look at. */
  example: { label: string; href: string; source: string } | null;
}

export interface Universal {
  entries: UniversalEntry[];
  sources: { id: string; label: string; kind: Source["kind"]; pages: number; functions: FunctionId[] }[];
}

/**
 * The universal list: every function that turns up more than once across
 * everything read, strongest first. Counted in **pages and parts**, not in sites —
 * three projects and a handful of apps is too thin a set of sites to call anything
 * universal, while a hundred and twenty pages and parts is evidence. A function
 * that appears once is one page that happens to be called something, not a rule.
 */
export function buildUniversal(sources: Source[]): Universal {
  const counted = new Map<FunctionId, Map<string, { label: string; href: string }>>();
  const items = new Map<FunctionId, number>();
  const perSource = new Map<string, Set<FunctionId>>();

  for (const source of sources) {
    const found = new Set<FunctionId>();
    for (const item of source.items) {
      const id = classifyPage(item.label, item.href ?? "");
      if (!id) continue;
      found.add(id);
      items.set(id, (items.get(id) ?? 0) + 1);
      const bySource = counted.get(id) ?? new Map<string, { label: string; href: string }>();
      if (!bySource.has(source.id)) bySource.set(source.id, { label: item.label, href: item.href ?? "" });
      counted.set(id, bySource);
    }
    perSource.set(source.id, found);
  }

  const usable = sources.filter((source) => source.items.length > 0);
  const entries: UniversalEntry[] = [];
  for (const [id, bySource] of counted) {
    if ((items.get(id) ?? 0) < 2) continue;
    const meta = BY_ID.get(id)!;
    const first = bySource.values().next().value as { label: string; href: string };
    const exampleSource = sources.find((source) => bySource.has(source.id))!;
    entries.push({
      id,
      label: meta.label,
      why: meta.why,
      have: usable.filter((source) => bySource.has(source.id)).map((source) => source.label),
      lack: usable.filter((source) => !bySource.has(source.id)).map((source) => source.label),
      coverage: items.get(id) ?? 0,
      sourceCount: bySource.size,
      everywhere: usable.every((source) => bySource.has(source.id)),
      example: { label: first.label, href: first.href, source: exampleSource.label },
    });
  }

  entries.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.sourceCount - a.sourceCount ||
      FUNCTIONS.findIndex((f) => f.id === a.id) - FUNCTIONS.findIndex((f) => f.id === b.id)
  );

  return {
    entries,
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      kind: source.kind,
      pages: source.items.length,
      functions: [...(perSource.get(source.id) ?? [])],
    })),
  };
}

export interface AuditPage {
  label: string;
  href: string;
}

export interface AuditResult {
  /** The universal functions the site has, and the page that carries each. */
  present: { id: FunctionId; label: string; page: AuditPage }[];
  /** The universal functions it does not have, after reading what it would give us. */
  missing: { id: FunctionId; label: string; why: string }[];
  /** Pages that could not be classified. Not faults: just not evidence. */
  unclassified: AuditPage[];
  /** True when the audit read too few pages to say anything. */
  thin: boolean;
}

const MIN_PAGES = 2;

/**
 * A site against the universal list. Only the functions on the universal list are
 * asked about: a site is not marked down for lacking something nothing else has.
 */
export function auditSite(pages: AuditPage[], universal: Universal): AuditResult {
  const found = new Map<FunctionId, AuditPage>();
  const unclassified: AuditPage[] = [];
  for (const page of pages) {
    const id = classifyPage(page.label, page.href);
    if (!id) {
      unclassified.push(page);
      continue;
    }
    if (!found.has(id)) found.set(id, page);
  }

  const present: AuditResult["present"] = [];
  const missing: AuditResult["missing"] = [];
  for (const entry of universal.entries) {
    const page = found.get(entry.id);
    if (page) present.push({ id: entry.id, label: entry.label, page });
    else missing.push({ id: entry.id, label: entry.label, why: entry.why });
  }

  return { present, missing, unclassified, thin: pages.length < MIN_PAGES };
}

/** A source straight from an Atlas project or Anything app: pages, or parts. */
export function sourceFromPages(
  id: string,
  label: string,
  kind: Source["kind"],
  items: { label: string; href?: string }[]
): Source {
  return { id, label, kind, items };
}
