import type { IncomingMessage, ServerResponse } from 'node:http';
import { LIST_KEY } from './subscribe.js';
import { command, pairsFromHash, sameToken, store } from './store.js';

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function subscribers(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, DELETE');
    res.statusCode = 405;
    return res.end('GET or DELETE required');
  }
  const token = process.env.SUBSCRIBERS_TOKEN;
  const admin = process.env.ADMIN_TOKEN;
  if (!token && !admin) {
    res.statusCode = 503;
    return res.end('Set SUBSCRIBERS_TOKEN to enable the export');
  }
  if (!sameToken(req.headers.authorization, token, admin)) {
    res.statusCode = 401;
    return res.end('Unauthorised');
  }

  const client = store();
  if (!client) {
    res.statusCode = 503;
    return res.end('List storage is not configured');
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url ?? '/', 'https://example.com');
    const body = (req.body ?? {}) as { email?: unknown };
    const email = String(body.email ?? url.searchParams.get('email') ?? '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      res.statusCode = 400;
      return res.end('Expected an email address');
    }
    try {
      await command(client, ['HDEL', LIST_KEY, email]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, removed: email }));
    } catch {
      res.statusCode = 503;
      return res.end('Could not update the list');
    }
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
