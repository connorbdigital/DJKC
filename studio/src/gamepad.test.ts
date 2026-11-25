import { describe, expect, it } from "vitest";
import { isIdle, pickGamepad, readGamepad, type GamepadLike } from "./gamepad";

const pad = (axes: number[], pressed: number[] = [], values: Record<number, number> = {}): GamepadLike => ({
  axes,
  buttons: Array.from({ length: 16 }, (_, index) => ({
    pressed: pressed.includes(index),
    value: values[index] ?? (pressed.includes(index) ? 1 : 0),
  })),
});

const rest = pad([0, 0, 0, 0]);

describe("reading a gamepad", () => {
  it("says nothing until a stick leaves the deadzone", () => {
    expect(isIdle(readGamepad(rest))).toBe(true);
    /* 0.1 of the travel is still a thumb resting. */
    expect(readGamepad(pad([0.1, -0.05, 0, 0])).move).toEqual({ forward: 0, strafe: 0 });
  });

  it("maps the left stick to walking, not to look", () => {
    const input = readGamepad(pad([0, -1, 0, 0]));
    expect(input.move.forward).toBe(1);
    expect(input.move.strafe).toBe(0);
    expect(input.look).toEqual({ x: 0, y: 0 });
    /* A push to the right walks right; -0 never escapes. */
    expect(readGamepad(pad([1, 0, 0, 0])).move).toEqual({ forward: 0, strafe: 1 });
  });

  it("maps the right stick to look, up is up", () => {
    const input = readGamepad(pad([0, 0, 0.5, -0.5]));
    expect(input.look.x).toBeCloseTo(0.5);
    expect(input.look.y).toBeCloseTo(-0.5);
    expect(input.move).toEqual({ forward: 0, strafe: 0 });
  });

  it("clamps a stick pushed past the rim", () => {
    const input = readGamepad(pad([0, -2, 0, 0]));
    expect(Math.hypot(input.move.forward, input.move.strafe)).toBeCloseTo(1);
  });

  it("lifts on RB and d-pad up, drops on LB and d-pad down, and cancels out", () => {
    expect(readGamepad(pad([0, 0, 0, 0], [5])).lift).toBe(1);
    expect(readGamepad(pad([0, 0, 0, 0], [12])).lift).toBe(1);
    expect(readGamepad(pad([0, 0, 0, 0], [4])).lift).toBe(-1);
    expect(readGamepad(pad([0, 0, 0, 0], [13])).lift).toBe(-1);
    expect(readGamepad(pad([0, 0, 0, 0], [4, 5])).lift).toBe(0);
  });

  it("boosts on a trigger past halfway or fully pulled", () => {
    expect(readGamepad(pad([0, 0, 0, 0], [], { 7: 0.2 })).boost).toBe(false);
    expect(readGamepad(pad([0, 0, 0, 0], [], { 7: 0.9 })).boost).toBe(true);
    expect(readGamepad(pad([0, 0, 0, 0], [6])).boost).toBe(true);
  });

  it("only interacts on the press, not while it is held", () => {
    const pressed = readGamepad(pad([0, 0, 0, 0], [0]));
    expect(pressed.interact).toBe(true);
    const held = readGamepad(pad([0, 0, 0, 0], [0]), pressed);
    expect(held.interact).toBe(false);
    expect(readGamepad(pad([0, 0, 0, 0], [9])).interact).toBe(true);
  });

  it("survives a pad that reports nonsense", () => {
    const broken = { axes: [Number.NaN, Infinity, 0, 0], buttons: [] } as unknown as GamepadLike;
    const input = readGamepad(broken);
    expect(input.move).toEqual({ forward: 0, strafe: 0 });
    expect(input.look).toEqual({ x: 0, y: 0 });
    expect(input.lift).toBe(0);
  });

  it("takes the first pad that is connected", () => {
    expect(pickGamepad([])).toBeNull();
    expect(pickGamepad([null, undefined])).toBeNull();
    const second = pad([0, 0, 0, 0]);
    expect(pickGamepad([{ ...rest, connected: false }, second])).toBe(second);
  });
});
