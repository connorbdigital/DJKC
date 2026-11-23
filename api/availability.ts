import type { IncomingMessage, ServerResponse } from 'node:http';
import { BOOKINGS_KEY, type Booking } from './bookings.js';
import { command, pairsFromHash, store } from './store.js';

/** Aggregate only: never returns names or contact details. */
export default async function availability(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: 'GET required' });
  }
  const date = new URL(req.url ?? '/', 'https://example.com').searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(400, { error: 'Expected ?date=YYYY-MM-DD' });

  const client = store();
  if (!client) return send(200, { date, status: 'unknown' });

  try {
    const { result } = await command(client, ['HGETALL', BOOKINGS_KEY]);
    const sameDay = pairsFromHash(result)
      .map(([, value]) => { try { return JSON.parse(value) as Booking; } catch { return null; } })
      .filter((b): b is Booking => Boolean(b) && b!.date === date);
    const status = sameDay.some((b) => b.status === 'confirmed')
      ? 'booked'
      : sameDay.length
        ? 'requested'
        : 'open';
    return send(200, { date, status });
  } catch {
    return send(200, { date, status: 'unknown' });
  }
}
