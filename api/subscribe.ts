import type { IncomingMessage, ServerResponse } from 'node:http';
import { command, store } from './store.js';

export const LIST_KEY = 'kc:mailing-list';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Coarse per-instance burst guard; add an edge rate limit for a hard ceiling. */
let windowStart = 0;
let requests = 0;

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export default async function subscribe(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(405, { error: 'POST required' });
  }
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON' });
  if (Date.now() - windowStart >= 3_600_000) {
    windowStart = Date.now();
    requests = 0;
  }
  if (requests >= 60) return send(429, { error: 'Try again later' });
  requests++;

  const email = normaliseEmail((req.body as { email?: unknown } | null)?.email);
  if (!email) return send(400, { error: 'Enter a valid email address' });

  const client = store();
  if (!client) return send(503, { error: 'List unavailable' });

  try {
    /* HSETNX keeps the first opt-in date if someone joins twice. */
    const { result } = await command(client, ['HSETNX', LIST_KEY, email, new Date().toISOString()]);
    return send(200, { ok: true, alreadyOnList: result === 0 });
  } catch {
    return send(503, { error: 'List unavailable' });
  }
}
