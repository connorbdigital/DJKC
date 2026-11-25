/**
 * A gamepad is two sticks and some buttons, which is exactly what the space
 * already understands: `setMoveInput` and `setLookInput`. All this module does is
 * read a pad and speak those units, so the maths lives where it can be tested
 * without a browser and without a controller plugged in.
 *
 * Standard mapping (the W3C one every modern pad reports):
 *   axes 0/1 left stick, 2/3 right stick (up is -1)
 *   buttons 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 select, 9 start,
 *   12–15 d-pad up/down/left/right
 */

import { stickVector } from "./sticks";

export interface GamepadInput {
  move: { forward: number; strafe: number };
  look: { x: number; y: number };
  lift: number;
  boost: boolean;
  /** True on the frame the interact button goes down, so a press selects once. */
  interact: boolean;
}

export interface GamepadLike {
  axes: ArrayLike<number>;
  buttons: ArrayLike<{ pressed: boolean; value?: number }>;
  connected?: boolean;
}

/** The first pad that is actually there. */
export function pickGamepad(pads: ArrayLike<GamepadLike | null | undefined>): GamepadLike | null {
  for (let index = 0; index < pads.length; index += 1) {
    const pad = pads[index];
    if (pad && pad.connected !== false) return pad;
  }
  return null;
}

const axis = (pad: GamepadLike, index: number): number => {
  const value = pad.axes[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const held = (pad: GamepadLike, index: number): boolean => Boolean(pad.buttons[index]?.pressed);

/**
 * Pad → inputs. `previous` is the last result, so `interact` can be a rising edge
 * rather than a level: holding A must not re-select a node sixty times a second.
 */
export function readGamepad(pad: GamepadLike, previous?: GamepadInput | null): GamepadInput {
  const left = stickVector(axis(pad, 0), axis(pad, 1), 1);
  const right = stickVector(axis(pad, 2), axis(pad, 3), 1);

  /* Triggers are buttons; either one is a reason to move faster. */
  const trigger = Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[6]?.value ?? 0);
  const boost = trigger > 0.4 || held(pad, 7) || held(pad, 6);

  const up = held(pad, 5) || held(pad, 12);
  const down = held(pad, 4) || held(pad, 13);
  const lift = (up ? 1 : 0) + (down ? -1 : 0);

  const interactDown = held(pad, 0) || held(pad, 9);

  return {
    /* Pushing the left stick away from you walks forward, as it does on the glass. */
    move: { forward: left.y === 0 ? 0 : -left.y, strafe: left.x === 0 ? 0 : left.x },
    look: { x: right.x, y: right.y },
    lift,
    boost,
    interact: interactDown && !previous?.interact,
  };
}

/** Whether an input would actually change anything — quiet pads must not spam the engine. */
export function isIdle(input: GamepadInput | null): boolean {
  if (!input) return true;
  return (
    input.move.forward === 0 &&
    input.move.strafe === 0 &&
    input.look.x === 0 &&
    input.look.y === 0 &&
    input.lift === 0 &&
    !input.boost &&
    !input.interact
  );
}
