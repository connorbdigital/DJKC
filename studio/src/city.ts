/**
 * The City: a building, not a metaphor.
 *
 * One corridor, eight rooms, a door per room. Each room holds a district of the
 * Atlas, so everything the Studio knows has somewhere with a floor, a wall and a
 * way in. The plan is data: it is computed once, tested for the things a building
 * must get right (rooms that do not overlap, a door that opens, a corridor with
 * nothing standing in it), and then drawn. Nothing here knows about pixels.
 */

import type { Atlas, AtlasNode, District } from "./atlas";

export type RoomId =
  | "projects"
  | "anything"
  | "library"
  | "shelf"
  | "gallery"
  | "content"
  | "packs"
  | "builder";

export interface CityRoom {
  id: RoomId;
  label: string;
  /** What goes over the door: one word, read from down the corridor. */
  sign: string;
  /** One line, on the sign and in the card. */
  blurb: string;
  districts: District[];
  /** Centre of the room. */
  x: number;
  z: number;
  /** Inner size. */
  w: number;
  d: number;
  side: "left" | "right";
  /** The doorway, on the corridor wall. */
  door: { x: number; z: number; width: number };
  /** The room's colour: the floor band, the door frame, the sign. */
  colour: string;
}

export interface CityWall {
  /** Centre of the wall block, and its size. */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface CityObject {
  node: AtlasNode;
  x: number;
  z: number;
  room: RoomId;
}

export interface CityPlan {
  rooms: CityRoom[];
  walls: CityWall[];
  objects: CityObject[];
  /** Room id → how many nodes the room could not hold. */
  hidden: Partial<Record<RoomId, number>>;
  /** Where you start: inside, looking down the corridor. */
  entrance: { x: number; z: number; heading: number };
}

export const CORRIDOR = {
  /** The corridor's half-width in z. */
  half: 3,
  /** The corridor's ends in x. */
  from: -30.5,
  to: 30.5,
  /** Wall height and thickness. */
  height: 3.4,
  thickness: 0.3,
} as const;

/** A doorway is wide enough for two people and tall enough for a sign above it. */
export const DOOR = { width: 3.2, height: 2.5 } as const;

/** Nobody wants to walk 57 plinths. A room shows its first sixteen and says how many it is holding back. */
export const MAX_OBJECTS = 24;

const ROOM = { w: 13, d: 9 } as const;
const COLUMNS = [-24, -8, 8, 24] as const;

export const CITY_ROOMS: CityRoom[] = [
  {
    id: "projects",
    label: "The Projects room",
    sign: "Projects",
    blurb: "Every project, one plinth each. A project has a room of its own behind it.",
    districts: ["projects"],
    x: COLUMNS[0],
    z: -ROOM.d / 2 - CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "left",
    door: { x: COLUMNS[0], z: -CORRIDOR.half, width: DOOR.width },
    colour: "#ff2bd6",
  },
  {
    id: "anything",
    label: "The Anything room",
    sign: "Anything",
    blurb: "The apps built on anything.com, and the modules inside them.",
    districts: ["anything"],
    x: COLUMNS[1],
    z: -ROOM.d / 2 - CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "left",
    door: { x: COLUMNS[1], z: -CORRIDOR.half, width: DOOR.width },
    colour: "#f472b6",
  },
  {
    id: "library",
    label: "The Library",
    sign: "Library",
    blurb: "The feature library: what already ships, and what it saves you.",
    districts: ["library"],
    x: COLUMNS[2],
    z: -ROOM.d / 2 - CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "left",
    door: { x: COLUMNS[2], z: -CORRIDOR.half, width: DOOR.width },
    colour: "#8c5bff",
  },
  {
    id: "shelf",
    label: "The Shelf",
    sign: "Shelf",
    blurb: "What is waiting on you, what shipped, and the links worth keeping.",
    districts: ["shelf"],
    x: COLUMNS[3],
    z: -ROOM.d / 2 - CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "left",
    door: { x: COLUMNS[3], z: -CORRIDOR.half, width: DOOR.width },
    colour: "#6ee7b7",
  },
  {
    id: "gallery",
    label: "The Gallery",
    sign: "Gallery",
    blurb: "Live sites, the ones built here and the ones worth copying.",
    districts: ["gallery"],
    x: COLUMNS[0],
    z: ROOM.d / 2 + CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "right",
    door: { x: COLUMNS[0], z: CORRIDOR.half, width: DOOR.width },
    colour: "#7dd3fc",
  },
  {
    id: "content",
    label: "The Writing room",
    sign: "Writing",
    blurb: "The blog plan: what to write, for whom, and why that one first.",
    districts: ["content"],
    x: COLUMNS[1],
    z: ROOM.d / 2 + CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "right",
    door: { x: COLUMNS[1], z: CORRIDOR.half, width: DOOR.width },
    colour: "#fdba74",
  },
  {
    id: "packs",
    label: "The Packs room",
    sign: "Packs",
    blurb: "What installs into a project, and what each pack expects to find.",
    districts: ["packs"],
    x: COLUMNS[2],
    z: ROOM.d / 2 + CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "right",
    door: { x: COLUMNS[2], z: CORRIDOR.half, width: DOOR.width },
    colour: "#c084fc",
  },
  {
    id: "builder",
    label: "The Workshop",
    sign: "Workshop",
    blurb: "The builder's steps: draft, branch, pull request, checks, merge.",
    districts: ["builder"],
    x: COLUMNS[3],
    z: ROOM.d / 2 + CORRIDOR.half,
    w: ROOM.w,
    d: ROOM.d,
    side: "right",
    door: { x: COLUMNS[3], z: CORRIDOR.half, width: DOOR.width },
    colour: "#facc15",
  },
];

/** Walls along one line, with a gap wherever a door interrupts them. */
function wallRun(
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  gaps: { at: number; width: number }[]
): CityWall[] {
  const cuts = gaps
    .map((gap) => ({ start: gap.at - gap.width / 2, end: gap.at + gap.width / 2 }))
    .filter((cut) => cut.end > from && cut.start < to)
    .sort((a, b) => a.start - b.start);
  const walls: CityWall[] = [];
  let cursor = from;
  for (const cut of cuts) {
    const start = Math.max(from, cut.start);
    if (start - cursor > 0.05) walls.push(block(axis, fixed, cursor, start));
    cursor = Math.max(cursor, Math.min(to, cut.end));
  }
  if (to - cursor > 0.05) walls.push(block(axis, fixed, cursor, to));
  return walls;
}

function block(axis: "x" | "z", fixed: number, start: number, end: number): CityWall {
  const length = end - start;
  const middle = start + length / 2;
  return axis === "x"
    ? { x: middle, z: fixed, w: length, d: CORRIDOR.thickness, h: CORRIDOR.height }
    : { x: fixed, z: middle, w: CORRIDOR.thickness, d: length, h: CORRIDOR.height };
}

/**
 * Which way a camera yaw faces on the floor plan. Three's camera looks down -z
 * at yaw 0, so a heading of -π/2 faces east along the corridor. Keeping the
 * conversion here means the plan never has to know about three.
 */
export function forwardOf(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function yawFor(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** Which room a point is standing in, or none if it is the corridor. */
export function roomAt(x: number, z: number, rooms: CityRoom[] = CITY_ROOMS): CityRoom | null {
  for (const room of rooms) {
    if (Math.abs(x - room.x) <= room.w / 2 && Math.abs(z - room.z) <= room.d / 2) return room;
  }
  return null;
}

/**
 * Laying out a room: a grid measured from the door wall, so nothing stands in
 * the threshold you walk through and nothing is closer than 2.8m to it.
 */
function roomSlots(room: CityRoom, count: number): { x: number; z: number }[] {
  const side = 1.8;
  const threshold = 3.6;
  const away = room.side === "left" ? -1 : 1;
  const usableW = room.w - side * 2;
  const usableD = room.d - threshold - side;
  /* Six across at the most: the room is wider than it is deep, so filling it
     sideways keeps a metre between plinths where filling it lengthways cannot. */
  const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(count * (usableW / Math.max(usableD, 1))))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const stepX = cols > 1 ? usableW / (cols - 1) : 0;
  const stepZ = rows > 1 ? usableD / (rows - 1) : usableD / 2;
  const slots: { x: number; z: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (slots.length >= count) return slots;
      slots.push({
        x: room.x - usableW / 2 + col * stepX,
        /* Depth from the doorway: never in the threshold. */
        z: room.door.z + away * (threshold + row * stepZ),
      });
    }
  }
  return slots;
}

/**
 * The whole building from the Atlas: rooms, walls, and one object per node.
 * The order inside a room is the Atlas's own order, so the room and the arm of
 * the space agree about what comes first.
 */
export function planCity(atlas: Atlas): CityPlan {
  const walls: CityWall[] = [];
  const leftDoors = CITY_ROOMS.filter((room) => room.side === "left").map((room) => ({ at: room.door.x, width: room.door.width }));
  const rightDoors = CITY_ROOMS.filter((room) => room.side === "right").map((room) => ({ at: room.door.x, width: room.door.width }));

  walls.push(...wallRun("x", -CORRIDOR.half, CORRIDOR.from, CORRIDOR.to, leftDoors));
  walls.push(...wallRun("x", CORRIDOR.half, CORRIDOR.from, CORRIDOR.to, rightDoors));

  for (const room of CITY_ROOMS) {
    const outer = room.side === "left" ? room.z - room.d / 2 : room.z + room.d / 2;
    /* The far wall, the two side walls, and the two short returns that meet the
       corridor wall on either side of the door. */
    walls.push(block("x", outer, room.x - room.w / 2, room.x + room.w / 2));
    walls.push(block("z", room.x - room.w / 2, Math.min(room.z - room.d / 2, room.z + room.d / 2), Math.max(room.z - room.d / 2, room.z + room.d / 2)));
    walls.push(block("z", room.x + room.w / 2, Math.min(room.z - room.d / 2, room.z + room.d / 2), Math.max(room.z - room.d / 2, room.z + room.d / 2)));
  }
  walls.push(block("z", CORRIDOR.from, -CORRIDOR.half, CORRIDOR.half));
  walls.push(block("z", CORRIDOR.to, -CORRIDOR.half, CORRIDOR.half));

  const objects: CityObject[] = [];
  const hidden: Partial<Record<RoomId, number>> = {};
  for (const room of CITY_ROOMS) {
    const nodes = atlas.nodes.filter((node) => room.districts.includes(node.district));
    const shown = nodes.slice(0, MAX_OBJECTS);
    if (nodes.length > shown.length) hidden[room.id] = nodes.length - shown.length;
    const slots = roomSlots(room, shown.length);
    shown.forEach((node, index) => {
      const slot = slots[index];
      if (slot) objects.push({ node, x: slot.x, z: slot.z, room: room.id });
    });
  }

  return {
    rooms: CITY_ROOMS,
    walls,
    objects,
    hidden,
    entrance: { x: CORRIDOR.from + 2.2, z: 0, heading: yawFor(1, 0) },
  };
}

/**
 * A radius-checked move: the building stops you walking through a wall, and
 * sliding along one is what a person does rather than stopping dead.
 */
export function canStand(x: number, z: number, walls: CityWall[], radius = 0.42): boolean {
  for (const wall of walls) {
    const halfW = wall.w / 2 + radius;
    const halfD = wall.d / 2 + radius;
    if (Math.abs(x - wall.x) < halfW && Math.abs(z - wall.z) < halfD) return false;
  }
  return true;
}

/** One step, split into two axes so a wall is slid along instead of blocked. */
export function step(x: number, z: number, dx: number, dz: number, walls: CityWall[], radius = 0.42): { x: number; z: number } {
  let nextX = x;
  let nextZ = z;
  if (canStand(x + dx, z, walls, radius)) nextX = x + dx;
  if (canStand(nextX, z + dz, walls, radius)) nextZ = z + dz;
  return { x: nextX, z: nextZ };
}

/** How to say "there are more of these than the room holds". */
export function ROOM_HIDDEN_LABEL(count: number): string {
  return `${count} more ${count === 1 ? "is" : "are"} in the Atlas, not on a plinth here`;
}

/** The room a door belongs to, for the sign above it. */
export function doorSign(room: CityRoom): string {
  return room.sign;
}
