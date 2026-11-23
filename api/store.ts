export type Store = { url: string; token: string };

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
