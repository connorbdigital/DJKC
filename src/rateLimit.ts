/**
 * A rate limit, in one file, with no dependency.
 *
 * Two endpoints in this repository spend money or someone else's bandwidth when
 * an unauthenticated request arrives: `/api/chat` asks a model, and the Studio's
 * `/api/site` fetches a stranger's page. Neither had a per-visitor limit; the chat
 * had one counter per warm instance, which is to say no limit at all once the
 * platform runs more than one.
 *
 * Why here and not a package: the two projects are deployed separately and each
 * bundles only its own root, so a shared module would either be copied anyway or
 * be missing in the build that needed it. `studio/src/rateLimit.ts` is the same
 * idea for the other root, and the two are kept in step by hand — sixty lines is
 * cheaper than a publish step nobody would maintain.
 *
 * A sliding window, not a fixed one: a fixed window lets a caller send the whole
 * allowance at 59.9s and again at 60.1s, which is the burst it was meant to stop.
 */

export interface LimitDecision {
  allowed: boolean;
  /** How many requests this key has left inside the window. */
  remaining: number;
  /** Milliseconds until the oldest request falls out of the window. 0 when allowed. */
  retryAfterMs: number;
  /** 1-based, for the human sentence: "the 21st request in a minute". */
  count: number;
}

export interface LimiterOptions {
  /** Requests allowed per key per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** How many keys to remember before the oldest is dropped. */
  maxKeys?: number;
}

export interface Limiter {
  check(key: string): LimitDecision;
  /** How many keys are being tracked. For tests and for the pulse. */
  size(): number;
  reset(): void;
}

/**
 * One limiter. `now` is injectable so a test can walk the clock instead of
 * sleeping, which is the difference between a suite that runs in milliseconds and
 * one that runs in minutes.
 */
export function createLimiter(options: LimiterOptions, now: () => number = Date.now): Limiter {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 5_000));
  const seen = new Map<string, number[]>();

  return {
    check(key: string): LimitDecision {
      const at = now();
      /* Old keys first: a map that grows by one entry per visitor is a slow leak on
         a function that is supposed to be cheap. */
      if (seen.size >= maxKeys && !seen.has(key)) {
        const oldest = seen.keys().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
      const stamps = (seen.get(key) ?? []).filter((stamp) => at - stamp < windowMs);
      if (stamps.length >= limit) {
        seen.set(key, stamps);
        const oldest = stamps[0] ?? at;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(1, oldest + windowMs - at),
          count: stamps.length + 1,
        };
      }
      stamps.push(at);
      seen.set(key, stamps);
      return { allowed: true, remaining: limit - stamps.length, retryAfterMs: 0, count: stamps.length };
    },
    size: () => seen.size,
    reset: () => seen.clear(),
  };
}

/**
 * Who to count against.
 *
 * The first entry in `x-forwarded-for` is the client as the edge saw it; the rest
 * of the list is the chain, and counting the chain would give everyone behind one
 * proxy a single allowance. A request with no address at all still gets counted,
 * under one shared key — that is deliberately harsh: something that cannot be
 * identified should not be the thing that spends the most.
 */
export function clientKey(headers?: Record<string, string | string[] | undefined> | null): string {
  const raw = headers?.["x-forwarded-for"] ?? headers?.["x-real-ip"] ?? headers?.["cf-connecting-ip"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  const address = (first ?? "").split(",")[0]?.trim();
  return address || "unknown";
}

/** The header a refusal owes the caller: whole seconds, never zero. */
export function retryAfterSeconds(decision: LimitDecision): string {
  return String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000)));
}
