import { describe, expect, it } from "vitest";
import { buildAtlas } from "./atlas";
import { CITY_ROOMS, CORRIDOR, MAX_OBJECTS, canStand, forwardOf, planCity, roomAt, step } from "./city";

const atlas = buildAtlas();
const plan = planCity(atlas);

describe("the building", () => {
  it("has a room per district, and no two rooms share a footprint", () => {
    expect(plan.rooms).toHaveLength(8);
    for (const a of plan.rooms) {
      for (const b of plan.rooms) {
        if (a.id === b.id) continue;
        const apart =
          Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
        expect(apart).toBe(true);
      }
    }
  });

  it("puts every door on the corridor wall, inside the room it belongs to", () => {
    for (const room of CITY_ROOMS) {
      const wallZ = room.side === "left" ? -CORRIDOR.half : CORRIDOR.half;
      expect(room.door.z).toBe(wallZ);
      expect(Math.abs(room.door.x - room.x)).toBeLessThanOrEqual(room.w / 2);
      expect(room.door.x).toBe(room.x);
    }
  });

  it("leaves the corridor clear, so you can walk from one end to the other", () => {
    for (let x = CORRIDOR.from + 1; x < CORRIDOR.to - 1; x += 0.5) {
      expect(canStand(x, 0, plan.walls)).toBe(true);
      /* Mid-way between two doorways, the wall is there. */
      const inDoor = CITY_ROOMS.some((room) => Math.abs(x - room.door.x) < room.door.width / 2 + 0.5);
      if (!inDoor) expect(canStand(x, CORRIDOR.half - 0.5, plan.walls)).toBe(false);
    }
  });

  it("leaves every doorway open, and the wall beside it shut", () => {
    for (const room of CITY_ROOMS) {
      const inside = room.side === "left" ? room.door.z + 0.6 : room.door.z - 0.6;
      expect(canStand(room.door.x, inside, plan.walls)).toBe(true);
      expect(canStand(room.door.x + 4, room.door.z, plan.walls)).toBe(false);
    }
  });

  it("puts the entrance inside, facing down the corridor", () => {
    expect(canStand(plan.entrance.x, plan.entrance.z, plan.walls)).toBe(true);
    const ahead = forwardOf(plan.entrance.heading);
    /* Looking east: the corridor runs to +x, and z stays put. */
    expect(ahead.x).toBeCloseTo(1, 5);
    expect(ahead.z).toBeCloseTo(0, 5);
  });

  it("slides along a wall instead of stopping dead", () => {
    /* Walking diagonally into the corridor's north wall keeps the sideways part. */
    const start = { x: 0, z: CORRIDOR.half - 1.2 };
    const moved = step(start.x, start.z, 1, 1, plan.walls);
    expect(moved.x).toBeCloseTo(1, 5);
    expect(moved.z).toBeLessThan(start.z + 1);
    expect(canStand(moved.x, moved.z, plan.walls)).toBe(true);
  });

  it("fills every room, without stacking two objects on each other", () => {
    for (const room of CITY_ROOMS) {
      const inRoom = plan.objects.filter((object) => object.room === room.id);
      /* The Anything room is empty until the account has apps: a room can be
         empty and still be a room, and it says so on the door. */
      if (room.id === "anything") {
        expect(inRoom).toHaveLength(0);
        continue;
      }
      expect(inRoom.length).toBeGreaterThan(0);
      expect(inRoom.length).toBeLessThanOrEqual(MAX_OBJECTS);
      for (const object of inRoom) {
        expect(Math.abs(object.x - room.x)).toBeLessThanOrEqual(room.w / 2 - 1.5);
        expect(Math.abs(object.z - room.z)).toBeLessThanOrEqual(room.d / 2 - 1.5);
        for (const other of inRoom) {
          if (other === object) continue;
          expect(Math.hypot(object.x - other.x, object.z - other.z)).toBeGreaterThan(1);
        }
      }
    }
  });

  it("says how many objects the room is holding back", () => {
    const shelfTotal = atlas.nodes.filter((node) => node.district === "shelf").length;
    const shelved = plan.objects.filter((object) => object.room === "shelf").length;
    expect(plan.hidden.shelf).toBe(shelfTotal - shelved);
    expect(plan.hidden.shelf).toBeGreaterThan(0);
  });

  it("knows which room you are standing in", () => {
    const projects = CITY_ROOMS.find((room) => room.id === "projects")!;
    expect(roomAt(projects.x, projects.z)?.id).toBe("projects");
    expect(roomAt(0, 0)).toBeNull();
    expect(roomAt(0, -2)).toBeNull();
    expect(roomAt(200, 200)).toBeNull();
  });

  it("never puts an object where you cannot stand", () => {
    for (const object of plan.objects) {
      expect(canStand(object.x, object.z, plan.walls, 0)).toBe(true);
    }
  });
});
