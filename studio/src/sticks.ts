/**
 * Stick maths, kept out of the component so it can be tested without a browser.
 *
 * Both sticks speak the same units: a vector inside the unit circle, where the
 * length is how hard you are pushing. The left stick's `forward` is up-the-screen
 * because that is what a person expects when they push a stick away from them;
 * the right stick's `look` is the drag it replaces, so the same push turns the
 * view up.
 */

export interface StickVector {
  x: number;
  y: number;
}

/** Fraction of the radius where the stick starts responding: no drift from a thumb. */
export const STICK_DEADZONE = 0.14;

export function stickVector(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE): StickVector {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(dx) || !Number.isFinite(dy)) return { x: 0, y: 0 };
  let x = dx / radius;
  let y = dy / radius;
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length)) return { x: 0, y: 0 };
  /* Past the rim the stick is still the stick: full speed, same direction. */
  if (length > 1) {
    x /= length;
    y /= length;
  }
  if (Math.min(1, length) < deadzone) return { x: 0, y: 0 };
  return { x, y };
}

/** Left stick: pushing away from you walks forward. */
export const moveFromStick = (stick: StickVector) => ({
  /* `-0` is a real value in IEEE arithmetic and a silly thing to hand an engine. */
  forward: stick.y === 0 ? 0 : -stick.y,
  strafe: stick.x === 0 ? 0 : stick.x,
});

/** Right stick: the same push that looks up in a drag looks up here. */
export const lookFromStick = (stick: StickVector) => ({ x: stick.x, y: stick.y });
