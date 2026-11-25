import { describe, expect, it } from "vitest";
import { STICK_DEADZONE, lookFromStick, moveFromStick, stickVector } from "./sticks";

describe("a thumb on a stick", () => {
  it("does not move until it is actually pushed", () => {
    expect(stickVector(0, 0, 60)).toEqual({ x: 0, y: 0 });
    /* A few pixels of thumb is not an instruction. */
    expect(stickVector(3, 2, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(60 * STICK_DEADZONE * 0.9, 0, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(60 * STICK_DEADZONE * 1.2, 0, 60).x).toBeGreaterThan(0);
  });

  it("gives full speed in the same direction past the rim", () => {
    const far = stickVector(240, 0, 60);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 5);
    expect(far.x).toBeCloseTo(1, 5);
    const diagonal = stickVector(300, 300, 60);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5);
    expect(diagonal.x).toBeCloseTo(diagonal.y, 5);
  });

  it("reads half a push as half", () => {
    expect(stickVector(30, 0, 60).x).toBeCloseTo(0.5, 5);
    expect(Math.hypot(...Object.values(stickVector(0, 30, 60)))).toBeCloseTo(0.5, 5);
  });

  it("refuses nonsense rather than turning the camera to NaN", () => {
    expect(stickVector(Number.NaN, 10, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
    expect(stickVector(10, 10, -5)).toEqual({ x: 0, y: 0 });
    expect(stickVector(10, 10, Number.POSITIVE_INFINITY)).toEqual({ x: 0, y: 0 });
  });

  it("walks forward when pushed away, and looks up when pushed away", () => {
    const pushedAway = stickVector(0, -60, 60);
    expect(moveFromStick(pushedAway)).toEqual({ forward: 1, strafe: 0 });
    expect(lookFromStick(pushedAway).y).toBeLessThan(0);

    const pushedRight = stickVector(60, 0, 60);
    const right = moveFromStick(pushedRight);
    expect(right.forward).toBe(0);
    expect(right.strafe).toBe(1);
    expect(lookFromStick(pushedRight)).toEqual({ x: 1, y: 0 });
  });
});
