import { describe, expect, it } from "vitest";
import { clientKey, createLimiter, retryAfterSeconds } from "./rateLimit";

/** A clock a test can walk. */
const clock = (start = 1_000_000) => {
  let at = start;
  return { now: () => at, tick: (ms: number) => (at += ms) };
};

describe("the limiter", () => {
  it("allows the allowance and refuses the one after it", () => {
    const limiter = createLimiter({ limit: 3, windowMs: 60_000 }, () => 0);
    const first = limiter.check("a");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    const second = limiter.check("a");
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
    const third = limiter.check("a");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = limiter.check("a");
    expect(fourth.allowed).toBe(false);
    expect(fourth.count).toBe(4);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts each key separately, so one visitor cannot spend another's allowance", () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 }, () => 0);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("slides: an old request falls out, and the next one is allowed again", () => {
    const timer = clock();
    const limiter = createLimiter({ limit: 2, windowMs: 60_000 }, timer.now);
    limiter.check("a");
    timer.tick(30_000);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    /* The first stamp is now 61s old; one slot has opened, not two. */
    timer.tick(31_000);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("does not let a fixed-window burst through: the boundary is not a reset", () => {
    const timer = clock();
    const limiter = createLimiter({ limit: 5, windowMs: 60_000 }, timer.now);
    for (let i = 0; i < 5; i++) limiter.check("a");
    /* Nine hundred milliseconds before the window ends, still refused. */
    timer.tick(59_100);
    expect(limiter.check("a").allowed).toBe(false);
    /* A fixed window would have let all five through again at 60_000. */
    timer.tick(1_000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("says how long to wait, in whole seconds, and never zero", () => {
    const timer = clock();
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 }, timer.now);
    limiter.check("a");
    timer.tick(100);
    const refused = limiter.check("a");
    expect(refused.allowed).toBe(false);
    expect(retryAfterSeconds(refused)).toBe("60");
    expect(Number(retryAfterSeconds(refused))).toBeGreaterThan(0);
  });

  it("forgets the oldest visitor rather than growing without end", () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 }, () => 0);
    limiter.check("a");
    limiter.check("b");
    expect(limiter.size()).toBe(1 + 1);
    limiter.check("c");
    expect(limiter.size()).toBe(2);
    /* "a" was evicted, so it is treated as new — the honest failure of a bounded
       map, and better than a leak that never stops. */
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("survives a nonsense configuration instead of dividing by zero", () => {
    const limiter = createLimiter({ limit: 0, windowMs: 0 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });
});

describe("who a request is counted against", () => {
  it("takes the first hop of x-forwarded-for, not the whole chain", () => {
    expect(clientKey({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" })).toBe("203.0.113.9");
    expect(clientKey({ "x-forwarded-for": ["198.51.100.4, 10.0.0.1"] })).toBe("198.51.100.4");
  });

  it("falls back to the other headers a proxy might set", () => {
    expect(clientKey({ "x-real-ip": "198.51.100.7" })).toBe("198.51.100.7");
    expect(clientKey({ "cf-connecting-ip": "198.51.100.8" })).toBe("198.51.100.8");
  });

  it("gives an unidentified request one shared key, which is deliberately harsh", () => {
    expect(clientKey({})).toBe("unknown");
    expect(clientKey({ "x-forwarded-for": "   " })).toBe("unknown");
  });
});
