/**
 * A project's own space: its pages as stars, and the links between them as
 * streams.
 *
 * The rule that matters is honesty. The ring of pages is what we know from the
 * project record. The streams are **read from the pages themselves** — a link is
 * drawn because an anchor on that page points at another page, never because a
 * diagram looked better with it. A page we could not read shows no streams and
 * says so, rather than pretending to a shape nobody checked.
 */

export interface SpacePage {
  /** Stable, derived from the href. */
  id: string;
  label: string;
  href: string;
}

export interface SpaceNode extends SpacePage {
  kind: "hub" | "page";
  /** Unit circle: the hub at 0,0, pages around it. */
  x: number;
  y: number;
  r: number;
  /** Whether this page's own links have been read. */
  read: boolean;
}

export interface SpaceEdge {
  from: string;
  to: string;
  /** `known` = the project record says this page exists; `live` = a real anchor. */
  source: "known" | "live";
}

export interface Space {
  hub: SpaceNode;
  nodes: SpaceNode[];
  edges: SpaceEdge[];
}

const clean = (href: string): string => href.split("#")[0]!.replace(/\/$/, "");

/** One page, one id: trailing slash and fragment are not a second page. */
export function pageId(href: string): string {
  const bare = clean(href).replace(/^https?:\/\//, "");
  return bare.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "page";
}

export function buildSpace(label: string, href: string, pages: { label: string; href: string }[]): Space {
  const hub: SpaceNode = { id: pageId(href || label), label, href, kind: "hub", x: 0, y: 0, r: 0.1, read: false };
  const seen = new Set<string>([hub.id]);
  const ring: SpaceNode[] = [];
  for (const page of pages) {
    /* A module has a name and no address: its name is its identity. */
    const id = pageId(page.href || page.label);
    if (seen.has(id)) continue;
    seen.add(id);
    ring.push({ id, label: page.label, href: page.href, kind: "page", x: 0, y: 0, r: 0.045, read: false });
  }
  /* Even spacing, ordered by label so the shape is the same every time it opens:
     a constellation that rearranges itself is a screenshot, not a map. */
  const ordered = [...ring].sort((a, b) => a.label.localeCompare(b.label));
  const radius = 0.62;
  ordered.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, ordered.length)) * Math.PI * 2;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });
  return {
    hub,
    nodes: ordered,
    edges: ordered.map((node) => ({ from: hub.id, to: node.id, source: "known" as const })),
  };
}

/**
 * The anchors on a page, made absolute, kept only where they stay on this site.
 * Off-site links are the internet, not this project's web; a mail client is not
 * a link at all.
 */
export function internalLinks(
  html: string,
  base: string,
  limit = 40
): { label: string; href: string }[] {
  let origin: URL;
  try {
    origin = new URL(base);
  } catch {
    return [];
  }
  const found = new Map<string, string>();
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]!.trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, origin);
    } catch {
      continue;
    }
    if (url.host !== origin.host) continue;
    if (!/^https?:$/.test(url.protocol)) continue;
    const key = clean(url.toString());
    if (key === clean(base)) continue;
    const text = match[2]!
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    /* First anchor wins: the first name for a page is usually the real one. */
    if (!found.has(key)) found.set(key, text || key);
    if (found.size >= limit) break;
  }
  return [...found.entries()].map(([href, label]) => ({ href, label }));
}

/**
 * Fold a page's real links into the space: add pages that were not on the ring,
 * add the streams, and mark the page as read. Positions for new nodes are taken
 * from the free angles nearest the page that links to them, so the web grows
 * outward from where it was read.
 */
export function mergeLive(space: Space, fromId: string, links: { label: string; href: string }[]): Space {
  const nodes = space.nodes.map((node) => ({ ...node }));
  const edges = space.edges.map((edge) => ({ ...edge }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const from = nodes.find((node) => node.id === fromId);
  if (from) from.read = true;

  /* A stream already drawn from the record is upgraded, not duplicated: the
     record said "this page exists", the page itself said "I link there". */
  const stream = (from: string, to: string, source: "known" | "live") => {
    const existing = edges.find((edge) => edge.from === from && edge.to === to);
    if (!existing) edges.push({ from, to, source });
    else if (source === "live") existing.source = "live";
  };

  for (const link of links) {
    const id = pageId(link.href);
    if (id === space.hub.id) {
      stream(fromId, space.hub.id, "live");
      continue;
    }
    let node = byId.get(id);
    if (!node) {
      node = { id, label: link.label, href: link.href, kind: "page", x: 0, y: 0, r: 0.04, read: false };
      nodes.push(node);
      byId.set(id, node);
      if (from) {
        /* A child sits a little further out, in the direction it was found. */
        const length = Math.hypot(from.x, from.y) || 0.4;
        node.x = (from.x / length) * Math.min(0.98, length + 0.18);
        node.y = (from.y / length) * Math.min(0.98, length + 0.18);
      }
      stream(space.hub.id, id, "known");
    }
    stream(fromId, id, "live");
  }
  return { hub: { ...space.hub }, nodes, edges };
}

/** How many streams lead into each page: the busiest page is the one to fix first. */
export function inbound(space: Space): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const edge of space.edges) counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
