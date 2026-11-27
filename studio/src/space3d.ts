import { PLATE_ASPECT } from "./plate";

/**
 * The geometry of a project's own space, in three dimensions.
 *
 * This file is pure arithmetic — no three, no React, no network — because the
 * shape of the room is the one part of it that can be wrong without anyone
 * noticing: a plate floating inside its star, a ring that does not close, a
 * camera that frames the middle of a wall. Everything the viewer does with the
 * numbers is over there in `ProjectSpace3D`; what the numbers *are* is here, and
 * is tested.
 *
 * The idea of the room: you stand in the middle of a project. Its front page is
 * the sun you are near. Every other page is a star on a ring around you, and a
 * page that has a picture has it hanging behind the star like a poster on the
 * wall of its own little bay — so the room is a room, not a diagram.
 */

export type Vec3 = [number, number, number];

export interface PlatePlacement {
  position: Vec3;
  /** Euler XYZ in radians: the poster faces away from the middle of the room. */
  rotation: Vec3;
  width: number;
  height: number;
}

export interface RingItem {
  id: string;
  /** Radians around Y. The first page always sits due north. */
  angle: number;
  position: Vec3;
  /** Sphere radius in scene units. */
  radius: number;
  /** Where this page's picture hangs, if it has one. */
  plate: PlatePlacement;
}

export interface RingOptions {
  /** Radius of the ring the stars stand on. */
  radius?: number;
  /** Height of the star at index 0. */
  y?: number;
  /** How far the heights swing either side of `y`. */
  sway?: number;
  /** Width of a hanging picture, in scene units. */
  plateWidth?: number;
}

/** Width of a page's poster. Its height follows the plate's own 640×400. */
export const PLATE_WIDTH = 3.5;
export const PLATE_HEIGHT = PLATE_WIDTH / PLATE_ASPECT;

const NORTH = -Math.PI / 2;

/**
 * A ring wide enough that neighbours do not touch, and wide enough that the
 * posters behind them do not overlap either. Below six pages the ring stops
 * shrinking and simply has gaps: a tight ring of three looks like a mistake.
 */
export function ringRadius(count: number, plateWidth = PLATE_WIDTH): number {
  const byWidth = (plateWidth * 1.85) / Math.max(2 * Math.sin(Math.PI / Math.max(count, 3)), 0.001);
  return round(clamp(Math.max(byWidth, 9), 9, 26));
}

/** One star per page, evenly spaced, with heights that swing so it reads as a room. */
export function ringLayout(ids: string[], options: RingOptions = {}): RingItem[] {
  const count = ids.length;
  if (count === 0) return [];
  const plateWidth = options.plateWidth ?? PLATE_WIDTH;
  const radius = options.radius ?? ringRadius(count, plateWidth);
  const baseY = options.y ?? 0;
  const sway = options.sway ?? Math.min(1.5, 0.35 + count * 0.12);
  const out: RingItem[] = ids.map((id, index) => {
    const angle = NORTH + (index / count) * Math.PI * 2;
    /* Heights advance by the golden angle rather than by a wave tied to the
       count: a wave of `2π · k · i / count` lands on the same height twice on a
       ring of two and four times on a ring of four, and a ring of four stars at
       one height is a floor with dots on it. This never repeats and never
       settles, so every count gets a room. */
    const y = baseY + Math.sin(index * 2.399963 + 0.8) * sway;
    const position: Vec3 = [round(Math.cos(angle) * radius), round(y), round(Math.sin(angle) * radius)];
    return {
      id,
      angle: round(angle),
      position,
      radius: count > 12 ? 0.42 : count > 8 ? 0.5 : 0.58,
      plate: plateAt(angle, radius, y, plateWidth),
    };
  });
  return out;
}

/**
 * The poster hangs *outside* its star and *above* it, like a banner on the wall
 * of its own bay. Outside, so it never covers the star it belongs to; above, so
 * it never covers the star next door — a ring of pictures at eye height is a row
 * of pictures over each other, and a picture you have to hunt for is not a
 * visual, it is a puzzle.
 */
export function plateAt(angle: number, radius: number, y: number, plateWidth = PLATE_WIDTH): PlatePlacement {
  const away = radius + plateWidth * 0.62;
  const height = plateWidth / PLATE_ASPECT;
  return {
    position: [round(Math.cos(angle) * away), round(y + height * 0.62), round(Math.sin(angle) * away)],
    /* A plane's face is +Z. Turned to the angle of the spoke, that face points
       outward, so every poster on the far side of the room is already looking at
       you. A 6° lean back keeps the top edge from disappearing. */
    rotation: [round(-0.06), round(Math.PI / 2 - angle), 0],
    width: round(plateWidth),
    height: round(height),
  };
}

export interface ArcOptions {
  /** How far the stream bows away from the straight line, in scene units. */
  bend?: number;
  /** How many segments the curve is split into. */
  segments?: number;
}

/**
 * A link between two pages, as a curve. Straighter than it is bowed: a stream
 * that loops like a phone cord reads as decoration, and these are claims.
 */
export function arcPoints(from: Vec3, to: Vec3, options: ArcOptions = {}): Vec3[] {
  const bend = options.bend ?? 0.22;
  const segments = Math.max(2, options.segments ?? 24);
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  /* Lift the control point away from the middle of the room, so streams bow
     outward instead of crossing the hub. */
  const outward = Math.hypot(mid[0], mid[2]) || 1;
  const control: Vec3 = [
    mid[0] + (mid[0] / outward) * length * bend,
    mid[1] + length * bend,
    mid[2] + (mid[2] / outward) * length * bend,
  ];
  const out: Vec3[] = [];
  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    out.push([
      round(a * from[0] + b * control[0] + c * to[0]),
      round(a * from[1] + b * control[1] + c * to[1]),
      round(a * from[2] + b * control[2] + c * to[2]),
    ]);
  }
  return out;
}

export interface Framing {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/**
 * Where to stand. Far enough back that the whole ring, and the posters behind
 * it, are inside the frame — and higher than the stars, because a ring seen from
 * its own floor is a line.
 */
export function framingFor(radius: number, options: { fov?: number } = {}): Framing {
  const fov = options.fov ?? 46;
  const half = (fov / 2) * (Math.PI / 180);
  const span = radius + PLATE_WIDTH * 0.9;
  const distance = Math.max((span / Math.tan(half)) * 1.08, radius * 1.6);
  return {
    position: [0, round(radius * 0.62 + 2.2), round(distance)],
    target: [0, 0, 0],
    fov,
  };
}

/** The colour a page's star is drawn in: one family, so the room looks like one room. */
export function toneFor(index: number, count: number): string {
  if (count <= 1) return "#ff2bd6";
  const hue = 316 - (index / count) * 140;
  return `hsl(${round(hue, 1)}, 94%, 72%)`;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
