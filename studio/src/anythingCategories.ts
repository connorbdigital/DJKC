/**
 * What an Anything project is made of, in the Studio's own words.
 *
 * The scan reads every module name in every project — 3,396 of them across 24
 * projects at the last build. A list of 41 names is an inventory; what is
 * actually useful is knowing that eleven of them are booking screens, that four
 * projects have a checkout and none has a sitemap, and which shelf each part
 * would go on if it were rebuilt here.
 *
 * So every module is classified against the seven shelves the library already
 * has — bookings, operations, marketing, store, design, search, storage — by
 * what the name and path say. It is a heuristic, and the UI says so: it is a
 * reading of names, not a reading of code, because the Anything API exposes an
 * inventory and not a repository.
 */
import type { Category } from "./types";

export interface PartReading {
  name: string;
  /** The shelf it would go on. */
  category: Category;
  /** Why it landed there, so the guess can be argued with. */
  because: string;
  /** Higher wins when two rules match the same word. */
  weight: number;
}

export interface AppReading {
  /** Parts per shelf. */
  counts: Record<Category, number>;
  /** Parts that matched no rule — pages, marketing copy, whatever. */
  uncategorised: number;
  /** The reading itself, longest lists first, capped for the panel. */
  parts: PartReading[];
  /** The shelf this app leans on most, or null when nothing matched. */
  dominant: Category | null;
}

/**
 * One rule per shelf. Order matters: the first rule whose words appear wins,
 * and the words are chosen to be specific — "checkout" is a store word, "shop"
 * is too, but "shop" appears in "workshop" and "photoshop", so it is matched
 * whole-word only.
 */
const RULES: { category: Category; words: string[]; because: string }[] = [
  {
    category: "bookings",
    because: "takes or manages an enquiry",
    words: [
      "book", "booking", "bookings", "reserve", "reservation", "appointment", "appointments",
      "schedule", "scheduling", "availability", "enquiry", "enquiries", "quote", "estimate",
      "order form", "request", "waitlist", "check-in",
    ],
  },
  {
    category: "store",
    because: "moves money or stock",
    words: [
      "cart", "checkout", "payment", "payments", "pay", "stripe", "price", "prices", "pricing",
      "product", "products", "catalog", "catalogue", "shop", "store", "basket", "subscription",
      "invoice", "billing", "discount", "coupon", "shipping", "merch", "tickets", "ticket",
    ],
  },
  {
    category: "operations",
    because: "runs the desk after the sale",
    words: [
      "admin", "dashboard", "desk", "staff", "team", "users", "user management", "settings",
      "notifications", "email", "emails", "inbox", "message", "messages", "chat", "calendar",
      "inventory", "stock", "tasks", "reports", "analytics", "blocked dates", "rota", "crm",
    ],
  },
  {
    category: "search",
    because: "helps a page be found",
    words: [
      "seo", "meta", "metadata", "sitemap", "robots", "schema", "structured data", "blog",
      "article", "articles", "post", "posts", "landing", "search", "faq", "faqs", "keywords",
      "llms", "feed", "rss", "opengraph",
    ],
  },
  {
    category: "marketing",
    because: "tells the story",
    words: [
      "home", "homepage", "about", "services", "offer", "offers", "testimonial", "testimonials",
      "reviews", "review", "gallery", "portfolio", "showcase", "press", "newsletter", "subscribe",
      "signup", "hero", "story", "contact", "contacts",
    ],
  },
  {
    category: "design",
    because: "sets how it looks and moves",
    words: [
      "theme", "style", "styles", "styleguide", "design", "layout", "navbar", "nav", "header",
      "footer", "hero section", "animation", "motion", "carousel", "slider", "modal", "fonts",
      "colours", "colors", "icons", "responsive", "ui kit",
    ],
  },
  {
    category: "storage",
    because: "keeps something for later",
    words: [
      "database", "data", "storage", "kv", "supabase", "firebase", "postgres", "sql", "upload",
      "uploads", "file", "files", "media", "assets", "export", "import", "backup", "backups",
      "auth", "login", "sign in", "session", "api",
    ],
  },
];

const normalise = (value: string) =>
  value
    .replace(/[._/\\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Read one module. `name` is what the project calls it; `path` is the file it
 * lives in, when Anything reports one. Whole-word matching only, so "bookings"
 * does not become "king" and "photoshop" does not become a shop.
 */
export function classifyPart(name: string, path?: string | null): PartReading {
  const haystack = ` ${normalise(name)} ${normalise(path ?? "")} `;
  let best: { category: Category; because: string; weight: number } | undefined;
  RULES.forEach((rule, ruleIndex) => {
    for (const word of rule.words) {
      const needle = ` ${word} `;
      if (!haystack.includes(needle)) continue;
      /* A longer word is a more specific signal, and earlier rules break ties —
         "booking checkout" is a booking, not a shop. */
      const weight = word.length * 10 - ruleIndex;
      if (!best || weight > best.weight) best = { category: rule.category, because: rule.because, weight };
    }
  });
  if (!best) return { name, category: "marketing", because: "reads as page copy", weight: 0 };
  return { name, category: best.category, because: best.because, weight: best.weight };
}

const emptyCounts = (): Record<Category, number> => ({
  bookings: 0,
  operations: 0,
  marketing: 0,
  store: 0,
  design: 0,
  search: 0,
  storage: 0,
});

/** Read a whole app: every part on a shelf, and the shape that falls out. */
export function categoriseApp(modules: string[], paths: Record<string, string | null> = {}): AppReading {
  const counts = emptyCounts();
  const parts: PartReading[] = [];
  let uncategorised = 0;
  const seen = new Set<string>();
  for (const name of modules) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    const reading = classifyPart(trimmed, paths[trimmed] ?? null);
    if (reading.weight === 0) uncategorised += 1;
    else counts[reading.category] += 1;
    parts.push(reading);
  }
  const ranked = (Object.entries(counts) as [Category, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return {
    counts,
    uncategorised,
    parts: parts.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)).slice(0, 60),
    dominant: ranked[0]?.[0] ?? null,
  };
}

/**
 * Across the whole account: which shelves the projects lean on, and how many
 * parts an "Anything" rebuild would have to place. This is the number the
 * Anything tab reports — evidence, not a guess.
 */
export function accountCategories(apps: { id: string; name: string; modules: string[] }[]): {
  counts: Record<Category, number>;
  uncategorised: number;
  total: number;
  projects: { id: string; name: string; dominant: Category | null; parts: number }[];
} {
  const counts = emptyCounts();
  let uncategorised = 0;
  let total = 0;
  const projects = apps.map((app) => {
    const reading = categoriseApp(app.modules);
    total += app.modules.length;
    uncategorised += reading.uncategorised;
    for (const [category, count] of Object.entries(reading.counts) as [Category, number][]) counts[category] += count;
    return { id: app.id, name: app.name, dominant: reading.dominant, parts: app.modules.length };
  });
  return { counts, uncategorised, total, projects };
}

export const categoryOrder: Category[] = ["bookings", "operations", "marketing", "store", "design", "search", "storage"];
