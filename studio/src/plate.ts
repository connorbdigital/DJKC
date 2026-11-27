/**
 * Plates: what a page actually looks like, taken from the page.
 *
 * The space draws stars, districts and buildings from its own data — geometry,
 * not imagery. A plate is the exception: it is cut from the HTML of a real page
 * (its title, its first heading, its own colour variables, its own picture) and
 * hung in the world, so a site is not only a position but a thing you can
 * recognise.
 *
 * This file is deliberately pure and opinion-free about drawing: it produces a
 * list of rectangles and strings, and `plateDraw.ts` puts them on a canvas. That
 * split is what makes the composition testable without a browser, and it means
 * the same plate can be drawn for the Atlas and for the City.
 *
 * What it is not: a screenshot. There is no headless browser behind this. A
 * plate is an extraction, and the note it carries says so.
 */

export const PLATE = { width: 640, height: 400 } as const;

/** 640 × 400 is 1.6 : 1, and every sprite that carries a plate is sized with this. */
export const PLATE_ASPECT = PLATE.width / PLATE.height;

export interface PageFacts {
  /** The page this was read from, as asked for. */
  url: string;
  /** The page's own title, or its host when it has none. */
  title: string;
  /** The page's first h1, with the tags taken out. */
  h1: string;
  /** The page's own description, one line of it. */
  description: string;
  /** Up to six colours the page declares for itself, in declaration order. */
  palette: string[];
  /** The page's own share picture, absolute. Null when it has none. */
  image: string | null;
}

export type PlateOp =
  | { kind: "fill"; x: number; y: number; w: number; h: number; colour: string; alpha?: number }
  | {
      kind: "text";
      x: number;
      y: number;
      size: number;
      colour: string;
      text: string;
      weight?: number;
      mono?: boolean;
    };

export interface PlateLayout {
  width: number;
  height: number;
  ops: PlateOp[];
  /** Where the page's own picture goes, if it has one. The drawer fills it or leaves it. */
  imageSlot: { x: number; y: number; w: number; h: number } | null;
  /** The colours the layout actually used, so a caller can tint a star to match. */
  palette: string[];
}

/* ------------------------------------------------------------------ colours */

const HEX = /#([0-9a-f]{3,8})\b/i;

/** `#abc` and `#aabbccdd` both become `#aabbcc`; anything else is null. */
export function normaliseHex(raw: string): string | null {
  const match = raw.trim().match(/^#([0-9a-f]+)$/i);
  if (!match) return null;
  const hex = match[1]!.toLowerCase();
  if (hex.length === 3) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  if (hex.length === 6) return `#${hex}`;
  if (hex.length === 8) return `#${hex.slice(0, 6)}`;
  return null;
}

/** Perceived lightness, 0–1: used to pick a readable ink for a plate's background. */
export function lightness(hex: string): number {
  const value = normaliseHex(hex) ?? "#000000";
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * The page's own colours: its `theme-color`, then every custom property it
 * declares that holds a hex value, in the order they appear. Nothing is
 * invented and nothing is re-ordered by taste — a plate that lies about a
 * palette is worse than a plate with no palette.
 */
export function paletteFrom(html: string): string[] {
  const found: string[] = [];
  const push = (value: string) => {
    const hex = normaliseHex(value);
    if (hex && !found.includes(hex)) found.push(hex);
  };

  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i);
  if (theme?.[1]) push(theme[1]);
  const themeBackwards = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
  if (themeBackwards?.[1]) push(themeBackwards[1]);

  for (const style of html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []) {
    for (const declaration of style.match(/--[a-z0-9-]+\s*:\s*#[0-9a-f]{3,8}\b/gi) ?? []) {
      const value = declaration.slice(declaration.indexOf(":") + 1);
      push(value);
      if (found.length >= 6) return found;
    }
  }

  /* Stylesheets are usually linked, not inlined, so a page can have no colours
     above. Fall back to the hexes it names in inline styles and markup. */
  if (found.length === 0) {
    for (const match of html.match(/style=["'][^"']*?(#[0-9a-f]{3,8})\b[^"']*["']/gi) ?? []) {
      const hex = match.match(HEX);
      if (hex?.[1]) push(`#${hex[1]}`);
      if (found.length >= 6) break;
    }
  }

  return found;
}

/* -------------------------------------------------------------------- facts */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  pound: "£",
  euro: "€",
  copy: "©",
};

export function decodeText(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole: string, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ");
}

function metaContent(html: string, name: string): string {
  const direct = html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")
  );
  if (direct?.[1]) return decodeText(direct[1]);
  const backwards = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i")
  );
  return backwards?.[1] ? decodeText(backwards[1]) : "";
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(decodeText(href), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The page's own share picture: og:image, then twitter:image, then its first <img>. */
export function imageFrom(html: string, base: string): string | null {
  for (const name of ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) {
    const value = metaContent(html, name);
    if (value) {
      const url = absolute(value, base);
      if (url) return url;
    }
  }
  const img = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return img?.[1] ? absolute(img[1], base) : null;
}

/** One page of HTML in, the facts a plate needs out. No network, no DOM. */
export function pageFacts(html: string, url: string): PageFacts {
  let host = url;
  try {
    host = new URL(url).host.replace(/^www\./, "");
  } catch {
    /* A URL that will not parse is still allowed to be drawn: the string is the title. */
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = metaContent(html, "og:title") || decodeText(titleTag) || host;
  const h1Raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const h1 = decodeText(stripTags(h1Raw)) || title;
  const description = metaContent(html, "og:description") || metaContent(html, "description");
  return {
    url,
    title,
    h1,
    description: description.slice(0, 220),
    palette: paletteFrom(html),
    image: imageFrom(html, url),
  };
}

/* -------------------------------------------------------------------- layout */

/** Break a line at word boundaries, and end with an ellipsis when it will not fit. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let cut = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (lines.length === maxLines) {
      cut = true;
      break;
    }
    line = word.length > maxChars ? `${word.slice(0, Math.max(1, maxChars - 1))}…` : word;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (cut || lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] ?? "";
    kept[maxLines - 1] = last.endsWith("…") ? last : `${last.slice(0, Math.max(1, maxChars - 1))}…`;
    return kept;
  }
  return lines;
}

/**
 * Approximate characters that fit on a line, for the fonts the Studio loads.
 * The estimate is deliberately a shade pessimistic: a heading that runs into
 * the page's picture looks like a bug, and a line that ends a word early looks
 * like typography.
 */
function charsFor(width: number, size: number, mono = false, tight = false): number {
  const per = size * (mono ? 0.62 : tight ? 0.6 : 0.55);
  return Math.max(8, Math.floor(width / per));
}

const INK = "#f6f1ff";
const DIM = "#a99cbd";
const PAPER = "#0b0713";

/** The ink that stays readable on a given background. */
function inkOn(background: string): { ink: string; dim: string } {
  return lightness(background) > 0.55
    ? { ink: "#12080f", dim: "#4a3a56" }
    : { ink: INK, dim: DIM };
}

/**
 * A plate for one page: the palette band across the top, the page's heading,
 * its description, and its own picture on the right where there is one.
 */
export function plateLayout(facts: PageFacts): PlateLayout {
  const { width, height } = PLATE;
  const palette = facts.palette.slice(0, 6);
  const background = palette[0] ?? PAPER;
  /* A page whose first colour is a pale cream is not a dark plate: the plate
     takes the page's colour and picks its ink to survive it. */
  const ink = inkOn(background);
  const ops: PlateOp[] = [{ kind: "fill", x: 0, y: 0, w: width, h: height, colour: background }];

  /* The band says "these are the page's colours", so it is drawn even for one. */
  const swatchWidth = width / Math.max(palette.length, 1);
  palette.forEach((colour, index) => {
    ops.push({ kind: "fill", x: index * swatchWidth, y: 0, w: swatchWidth, h: 12, colour });
  });

  const hasImage = Boolean(facts.image);
  const columnWidth = hasImage ? 344 : width - 56;

  ops.push({
    kind: "text",
    x: 28,
    y: 34,
    size: 12,
    colour: ink.dim,
    text: hostOf(facts.url).toUpperCase(),
    mono: true,
  });

  const headingSize = facts.h1.length > 46 ? 27 : facts.h1.length > 28 ? 31 : 36;
  const heading = wrapText(facts.h1, charsFor(columnWidth, headingSize, false, true), 3);
  heading.forEach((line, index) => {
    ops.push({
      kind: "text",
      x: 28,
      y: 58 + index * (headingSize + 6),
      size: headingSize,
      colour: ink.ink,
      text: line,
      weight: 600,
    });
  });

  const afterHeading = 58 + heading.length * (headingSize + 6) + 12;
  const body = wrapText(facts.description, charsFor(columnWidth, 15), 4);
  body.forEach((line, index) => {
    ops.push({
      kind: "text",
      x: 28,
      y: afterHeading + index * 21,
      size: 15,
      colour: ink.dim,
      text: line,
    });
  });

  /* The honesty line. A plate is not a screenshot and must not pass as one. */
  ops.push({
    kind: "text",
    x: 28,
    y: height - 32,
    size: 10,
    colour: ink.dim,
    text: "cut from the page's own HTML",
    mono: true,
  });

  const imageSlot = hasImage ? { x: 392, y: 34, w: 220, h: 296 } : null;
  if (imageSlot) {
    /* The slot is washed in the page's own colour, not grey: if the picture will
       not load the plate should look unfinished, not broken. */
    ops.push({
      kind: "fill",
      x: imageSlot.x,
      y: imageSlot.y,
      w: imageSlot.w,
      h: imageSlot.h,
      colour: palette[2] ?? palette[1] ?? ink.dim,
      alpha: 0.22,
    });
  }

  return { width, height, ops, imageSlot, palette };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A plate for one file: the real first lines of it, in mono, under its path.
 * This is what a component looks like in the space — not an icon, the code.
 */
export function codePlateLayout(input: {
  path: string;
  text: string;
  palette?: string[];
  lines?: number;
}): PlateLayout {
  const { width, height } = PLATE;
  const palette = (input.palette ?? []).slice(0, 6);
  const accent = palette[1] ?? palette[0] ?? "#38bdf8";
  const limit = input.lines ?? 15;
  const source = input.text.replace(/\r\n/g, "\n").split("\n");
  const shown = source.slice(0, limit);

  const ops: PlateOp[] = [
    { kind: "fill", x: 0, y: 0, w: width, h: height, colour: PAPER },
    { kind: "fill", x: 0, y: 0, w: 6, h: height, colour: accent },
    { kind: "text", x: 22, y: 18, size: 13, colour: "#d8c9f2", text: input.path, mono: true },
    { kind: "fill", x: 22, y: 42, w: width - 44, h: 1, colour: "#2a1f3d" },
  ];

  shown.forEach((line, index) => {
    const y = 56 + index * 21;
    const text = line.replace(/\t/g, "  ").slice(0, 74);
    ops.push({ kind: "text", x: 22, y, size: 12, colour: "#6f6088", text: String(index + 1).padStart(2, " "), mono: true });
    ops.push({ kind: "text", x: 56, y, size: 12, colour: "#e9e2f7", text, mono: true });
  });

  const more = source.length > limit ? `${source.length - limit} more lines` : `${source.length} lines`;
  ops.push({ kind: "text", x: 22, y: height - 26, size: 10, colour: "#6f6088", text: `${more} · cut from the file`, mono: true });

  return { width, height, ops, imageSlot: null, palette };
}
