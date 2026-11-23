import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LIST_KEY } from './subscribe.js';
import { command, pairsFromHash, store } from './store.js';

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

function authorised(header: string | string[] | undefined, token: string) {
  const offered = (Array.isArray(header) ? header[0] : header)?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(offered);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function subscribers(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('GET required');
  }
  const token = process.env.SUBSCRIBERS_TOKEN;
  if (!token) {
    res.statusCode = 503;
    return res.end('Set SUBSCRIBERS_TOKEN to enable the export');
  }
  if (!authorised(req.headers.authorization, token)) {
    res.statusCode = 401;
    return res.end('Unauthorised');
  }

  const client = store();
  if (!client) {
    res.statusCode = 503;
    return res.end('List storage is not configured');
  }

  try {
    const { result } = await command(client, ['HGETALL', LIST_KEY]);
    const pairs = pairsFromHash(result);

    if (new URL(req.url ?? '/', 'https://example.com').searchParams.get('format') === 'json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ count: pairs.length, subscribers: pairs.map(([email, at]) => ({ email, at })) }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dj-kc-mailing-list.csv"');
    res.end(['email,subscribed_at', ...pairs.map(([email, at]) => `${csvCell(email)},${csvCell(at)}`)].join('\n'));
  } catch {
    res.statusCode = 503;
    res.end('Could not read the list');
  }
}
