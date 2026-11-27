import { describe, expect, it } from "vitest";
import { PLATE_ASPECT } from "./plate";
import { arcPoints, framingFor, plateAt, PLATE_HEIGHT, PLATE_WIDTH, ringLayout, ringRadius, toneFor } from "./space3d";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `page-${index}`);
const radial = (position: [number, number, number]) => Math.hypot(position[0], position[2]);

describe("ringLayout", () => {
  it("gives no stars for no pages", () => {
    expect(ringLayout([])).toEqual([]);
  });

  it("puts every star on the ring, at the radius it was handed", () => {
    const items = ringLayout(ids(9), { radius: 11 });
    expect(items).toHaveLength(9);
    for (const item of items) expect(radial(item.position)).toBeCloseTo(11, 3);
  });

  it("is a ring you can count: distinct angles, evenly spaced, starting due north", () => {
    const items = ringLayout(ids(8));
    const step = (Math.PI * 2) / 8;
    items.forEach((item, index) => expect(item.angle).toBeCloseTo(-Math.PI / 2 + index * step, 4));
    expect(new Set(items.map((item) => item.angle)).size).toBe(8);
  });

  it("is deterministic: the same pages give the same room", () => {
    expect(ringLayout(ids(7))).toEqual(ringLayout(ids(7)));
  });

  it("swings the heights, so the ring is a room rather than a floor", () => {
    for (const count of [2, 3, 4, 5, 8, 13]) {
      const heights = ringLayout(ids(count)).map((item) => item.position[1]);
      expect(new Set(heights).size).toBeGreaterThan(1);
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.4);
    }
  });

  it("hangs each poster outside its own star, never inside it", () => {
    const items = ringLayout(ids(6), { radius: 10 });
    for (const item of items) {
      expect(radial(item.plate.position)).toBeGreaterThan(radial(item.position) + 1);
      // On the same spoke: the angle round Y is unchanged.
      expect(Math.atan2(item.plate.position[2], item.plate.position[0])).toBeCloseTo(
        Math.atan2(item.position[2], item.position[0]),
        3
      );
    }
  });

  it("hangs posters above their star, by less than their own height", () => {
    for (const item of ringLayout(ids(5))) {
      const rise = item.plate.position[1] - item.position[1];
      expect(rise).toBeGreaterThan(0);
      expect(rise).toBeLessThan(item.plate.height);
    }
  });

  it("keeps the plate's own proportions", () => {
    expect(PLATE_HEIGHT).toBeCloseTo(PLATE_WIDTH / PLATE_ASPECT, 6);
    const [item] = ringLayout(ids(3));
    expect(item!.plate.width / item!.plate.height).toBeCloseTo(PLATE_ASPECT, 3);
  });

  it("widens the ring with the count, and stops widening somewhere sensible", () => {
    expect(ringRadius(3)).toBe(9);
    expect(ringRadius(20)).toBeGreaterThan(ringRadius(8));
    expect(ringRadius(40)).toBeLessThanOrEqual(26);
    // Neighbours on a full ring keep more than a poster's width between them.
    const count = 12;
    const radius = ringRadius(count);
    const gap = 2 * radius * Math.sin(Math.PI / count);
    expect(gap).toBeGreaterThan(PLATE_WIDTH);
  });
});

describe("plateAt", () => {
  it("turns the poster's face away from the middle of the room", () => {
    const angle = 0.9;
    const plate = plateAt(angle, 9, 0);
    const rotation = plate.rotation;
    // A plane faces +Z; after a rotation of y, that direction is (sin y, 0, cos y).
    const normal = [Math.sin(rotation[1]), 0, Math.cos(rotation[1])];
    const outward = [plate.position[0], 0, plate.position[2]];
    const dot = normal[0]! * outward[0]! + normal[2]! * outward[2]!;
    expect(dot).toBeGreaterThan(0);
  });
});

describe("arcPoints", () => {
  const from = [6, 1, 0] as [number, number, number];
  const to = [0, -1, 6] as [number, number, number];

  it("starts at one page and ends at the other", () => {
    const points = arcPoints(from, to, { segments: 12 });
    expect(points).toHaveLength(13);
    expect(points[0]).toEqual(from);
    expect(points[12]).toEqual(to);
  });

  it("bows away from the straight line, and above it", () => {
    const points = arcPoints(from, to, { segments: 12, bend: 0.3 });
    const middle = points[6]!;
    const chordMid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    expect(middle[1]).toBeGreaterThan(chordMid[1]!);
    expect(radial(middle)).toBeGreaterThan(Math.hypot(chordMid[0]!, chordMid[2]!));
  });

  it("never needs more than two segments", () => {
    expect(arcPoints(from, to, { segments: 1 })).toHaveLength(3);
  });
});

describe("framingFor", () => {
  it("stands back far enough to hold the ring and its posters", () => {
    const framing = framingFor(10);
    const half = (framing.fov / 2) * (Math.PI / 180);
    const visible = Math.tan(half) * Math.abs(framing.position[2]);
    expect(visible).toBeGreaterThan(10 + PLATE_WIDTH);
  });

  it("stands higher than the ring, and looks at its middle", () => {
    const framing = framingFor(12);
    expect(framing.position[1]).toBeGreaterThan(3);
    expect(framing.target).toEqual([0, 0, 0]);
  });

  it("goes further back for a wider room", () => {
    expect(framingFor(18).position[2]).toBeGreaterThan(framingFor(8).position[2]);
  });
});

describe("toneFor", () => {
  it("gives every page a colour in one family", () => {
    const tones = [0, 1, 2, 3, 4].map((index) => toneFor(index, 5));
    expect(new Set(tones).size).toBe(5);
    for (const tone of tones) expect(tone).toMatch(/^hsl\(\d+(\.\d+)?, 94%, 72%\)$/);
  });

  it("is stable, and safe for a single page", () => {
    expect(toneFor(3, 9)).toBe(toneFor(3, 9));
    expect(toneFor(0, 1)).toBe("#ff2bd6");
  });
});
