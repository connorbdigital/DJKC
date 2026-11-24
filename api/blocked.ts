import type { IncomingMessage, ServerResponse } from 'node:http';
import { command, pairsFromHash, sameToken, store } from './store.js';

export const BLOCKED_KEY = 'kc:blocked-dates';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function blocked(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  const bookToken = process.env.BOOKINGS_TOKEN;
  const admin = process.env.ADMIN_TOKEN;
  if (!bookToken && !admin) return send(503, { error: 'Set ADMIN_TOKEN to manage blocked dates' });
  if (!sameToken(req.headers.authorization, bookToken, admin)) return send(401, { error: 'Unauthorised' });
  const client = store();
  if (!client) return send(503, { error: 'Storage unavailable' });

  try {
    if (req.method === 'GET') {
      const { result } = await command(client, ['HGETALL', BLOCKED_KEY]);
      const dates = pairsFromHash(result)
        .map(([date, value]) => {
          try {
            return { date, ...(JSON.parse(value) as { reason?: string; at?: string }) };
          } catch {
            return { date };
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      return send(200, { count: dates.length, blocked: dates });
    }

    const body = (req.body ?? {}) as { date?: unknown; reason?: unknown };
    const date = typeof body.date === 'string' ? body.date : '';

    if (req.method === 'POST') {
      if (!DATE.test(date)) return send(400, { error: 'Expected YYYY-MM-DD' });
      if (date < new Date().toISOString().slice(0, 10)) return send(400, { error: 'That date has passed' });
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
      await command(client, ['HSET', BLOCKED_KEY, date, JSON.stringify({ reason, at: new Date().toISOString() })]);
      return send(200, { ok: true, date, reason });
    }

    if (req.method === 'DELETE') {
      if (!DATE.test(date)) return send(400, { error: 'Expected YYYY-MM-DD' });
      await command(client, ['HDEL', BLOCKED_KEY, date]);
      return send(200, { ok: true, date });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(405, { error: 'Method not allowed' });
  } catch {
    return send(503, { error: 'Storage unavailable' });
  }
}
