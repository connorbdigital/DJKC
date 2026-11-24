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

export type NodeKind = "project" | "capability" | "step" | "pack" | "brief" | "site";
export type District = "library" | "projects" | "builder" | "packs" | "content" | "gallery";

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

/** The three projects this Studio has actually read. */
export const PROJECTS = [
  {
    id: "project-djkc",
    label: "DJKC — the site",
    line: "Kaysie Cork, wedding DJ in Manchester. Booking form, prices, availability.",
    detail:
      "The first project the Studio was built for: a single-page site with a priced enquiry form, a Stripe deposit, a booking desk and static pages generated for search. 66 tests.",
    bullets: ["React + Vite + Tailwind", "api/ on Vercel", "66 tests, 9 static pages generated", "Owner: connorbdigital"],
    href: "/",
  },
  {
    id: "project-studio",
    label: "Studio — the builder",
    line: "Inventory, feature library, agent drafts, pull requests, merge gate.",
    detail:
      "The app you are standing in. Reads GitHub, knows 13 processes on 7 shelves, drafts a change into a branch, opens a PR, runs the checks, and refuses to merge its own work.",
    bullets: ["79 tests", "PROCESSES.md generated from features.ts", "Never merges", "This Atlas is part of it"],
    href: "/",
  },
  {
    id: "project-commerce",
    label: "Commerce — the shop",
    line: "Exommeece: 32 products, 12 departments, a static build and the commission maths.",
    detail:
      "A storefront framework and a working shop: money as integers, a product validator, a search box that cannot dead-end, 50 generated pages, and the affiliate rates as typed data.",
    bullets: ["119 tests", "npm run site → 50 pages", "Product + Offer + FAQPage schema", "No payment provider, and it says so"],
    href: "/",
  },
] as const;

/** Websites you can pull into the gallery and look at from any angle. */
export const SITES = [
  { id: "site-sitebuildup", label: "sitebuildup.co.uk", url: "https://www.sitebuildup.co.uk/", kind: "Your site" },
  { id: "site-exommeece", label: "exommeece.co.uk", url: "https://exommeece.co.uk/", kind: "The demo shop" },
  { id: "site-amazon", label: "amazon.co.uk", url: "https://www.amazon.co.uk/", kind: "Reference: scale" },
  { id: "site-argos", label: "argos.co.uk", url: "https://www.argos.co.uk/", kind: "Reference: checkout" },
  { id: "site-wayfair", label: "wayfair.co.uk", url: "https://www.wayfair.co.uk/", kind: "Reference: catalogue" },
  { id: "site-ikea", label: "ikea.com/gb", url: "https://www.ikea.com/gb/en/", kind: "Reference: navigation" },
  { id: "site-therange", label: "therange.co.uk", url: "https://www.therange.co.uk/", kind: "Reference: taxonomy" },
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
  { id: "content", label: "The blog plan", blurb: "Every post for sitebuildup.co.uk, with the number it argues from.", centre: [0, 16, 96] },
  { id: "gallery", label: "The gallery", blurb: "Live sites you can fly up to. Some refuse to be framed; the card tells you so.", centre: [0, 30, 250] },
];

/**
 * The space is deliberately small: a bigger one is impressive for ten seconds
 * and tiring for ten minutes. These distances are in "metres" of flight.
 */
export const WORLD_SCALE = 0.62;

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

export function buildAtlas(custom: CustomProject[] = []): Atlas {
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
      size: 1.9,
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
      position: [round(92 + position[0]), position[1], round(position[2])],
      size: 4.6,
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
      position: [round(92 + position[0]), round(8 + position[1]), round(position[2])],
      size: 4.2,
      ...(project.href ? { href: project.href } : {}),
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
      size: 1.9,
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
      position: [round(position[0]), round(34 + position[1]), round(-92 + position[2])],
      size: 3.2,
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
    const position: [number, number, number] = [(column - (COLUMNS - 1) / 2) * 10.6, 10 + row * 11, 96 + Math.pow(column - 3, 2) * 0.55];
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
      size: 2.4,
    });
    edges.push({ from: `brief-${brief.slug}`, to: `cap-${brief.capability}`, kind: "proves" });
  });

  /* ------------------------------------------------------------- gallery */
  /* A filmstrip, not a ring: seven screens in a row, spaced so the panels
     (10.8 world units wide) sit side by side with a small gap, facing the way
     you arrive. */
  SITES.forEach((site, index) => {
    const position: [number, number, number] = [(index - (SITES.length - 1) / 2) * 19, 0, 250];
    nodes.push({
      id: site.id,
      kind: "site",
      district: "gallery",
      label: site.label,
      line: `${site.kind} — ${site.url}`,
      detail: `A live page you can open as a panel in the space and fly around. Some sites refuse to be embedded by any other domain; when that happens the panel shows the card instead, with the link.`,
      bullets: [site.url, site.kind],
      position: [round(position[0]), round(30 + position[1]), round(position[2])],
      size: 3.0,
      href: site.url,
    });
  });

  for (const node of nodes) {
    node.position = [round(node.position[0] * WORLD_SCALE), round(node.position[1] * WORLD_SCALE), round(node.position[2] * WORLD_SCALE)];
  }
  const districts = DISTRICTS.map((district) => ({
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
  project: "#8c5bff",
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
