import { timingSafeEqual } from 'node:crypto';

export type Store = { url: string; token: string };

/** Constant-time check of a `Bearer …` header against one or more allowed tokens. */
export function sameToken(header: string | string[] | undefined, ...expected: (string | undefined)[]) {
  const offered = (Array.isArray(header) ? header[0] : header)?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(offered);
  return expected.some((value) => {
    if (!value) return false;
    const b = Buffer.from(value);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Upstash Redis over REST: configured by Vercel KV or explicit Upstash variables. */
export function store(): Store | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export async function command(client: Store, args: (string | number)[]) {
  const response = await fetch(client.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${client.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Store responded ${response.status}`);
  return (await response.json()) as { result?: unknown };
}

export function pairsFromHash(result: unknown): [string, string][] {
  if (Array.isArray(result)) {
    const rows: [string, string][] = [];
    for (let i = 0; i < result.length; i += 2) rows.push([String(result[i]), String(result[i + 1] ?? '')]);
    return rows;
  }
  return Object.entries((result as Record<string, string>) ?? {});
}
