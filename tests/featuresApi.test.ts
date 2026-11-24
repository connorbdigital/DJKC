import { afterEach, expect, it, vi } from 'vitest';
import bookings, { BOOKINGS_KEY } from '../api/bookings';
import blocked from '../api/blocked';
import availability from '../api/availability';
import subscribers from '../api/subscribers';
import deposit from '../api/deposit';
import calendar from '../api/calendar';

function fakeRes() {
  const res = { headers: {} as Record<string, string>, statusCode: 0, body: '', setHeader(k: string, v: string) { res.headers[k] = v; }, end(b?: string) { res.body = b ?? ''; } };
  return res;
}
const json = (body: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body }) as never;
const admin = { authorization: 'Bearer desk-secret', 'content-type': 'application/json' };
const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const valid = { name: 'Alex Carter', email: 'alex@example.org', venue: 'Freight Island', area: 'UK — North West', date: nextMonth, package: 'Signature Live', message: 'Peak time please.' };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('emails the desk when Resend is configured and still stores the booking if it fails', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('ADMIN_TOKEN', 'desk-secret');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('NOTIFY_EMAIL', 'desk@example.org');
  vi.stubEnv('NOTIFY_FROM', 'DJ KC <bookings@djkcmusic.com>');

  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes('api.resend.com')) return { ok: true, json: async () => ({ id: 'mail_1' }) };
    if (String(url).includes('api.stripe.com')) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ result: 1 }) };
  });
  vi.stubGlobal('fetch', fetch);

  const res = fakeRes();
  await bookings(json(valid), res as never);
  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body);
  expect(body.notified).toBe(true);
  const mail = fetch.mock.calls.find(([u]) => String(u).includes('resend'));
  const payload = JSON.parse(String(mail![1]?.body));
  expect(payload.to).toEqual(['desk@example.org']);
  expect(payload.reply_to).toBe('alex@example.org');
  expect(payload.subject).toContain('Freight Island');
  expect(payload.text).toContain(body.id);

  fetch.mockImplementation(async (url: string) => {
    if (String(url).includes('resend')) throw new Error('mail down');
    return { ok: true, json: async () => ({ result: 1 }) };
  });
  const second = fakeRes();
  await bookings(json({ ...valid, venue: 'Second Room' }), second as never);
  expect(second.statusCode).toBe(201);
  expect(JSON.parse(second.body).notified).toBe(false);
});

it('blocks and reopens dates, and reports them as unavailable', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('ADMIN_TOKEN', 'desk-secret');
  const stored: Record<string, string> = {};
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    const command = JSON.parse(init.body);
    if (command[0] === 'HSET') { stored[command[2]] = command[3]; return { ok: true, json: async () => ({ result: 1 }) }; }
    if (command[0] === 'HDEL') { delete stored[command[2]]; return { ok: true, json: async () => ({ result: 1 }) }; }
    if (command[0] === 'HGET') return { ok: true, json: async () => ({ result: stored[command[2]] }) };
    if (command[0] === 'HGETALL') return { ok: true, json: async () => ({ result: Object.entries(stored).flat() }) };
    return { ok: true, json: async () => ({ result: null }) };
  });
  vi.stubGlobal('fetch', fetch);

  const denied = fakeRes();
  await blocked({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { date: nextMonth } } as never, denied as never);
  expect(denied.statusCode).toBe(401);

  const past = fakeRes();
  await blocked({ method: 'POST', headers: admin, body: { date: '2020-01-01' } } as never, past as never);
  expect(past.statusCode).toBe(400);

  const created = fakeRes();
  await blocked({ method: 'POST', headers: admin, body: { date: nextMonth, reason: 'Holiday' } } as never, created as never);
  expect(created.statusCode).toBe(200);

  const available = fakeRes();
  await availability({ method: 'GET', url: `/api/availability?date=${nextMonth}`, headers: {} } as never, available as never);
  expect(JSON.parse(available.body)).toEqual({ date: nextMonth, status: 'blocked' });

  const list = fakeRes();
  await blocked({ method: 'GET', headers: admin } as never, list as never);
  expect(JSON.parse(list.body).blocked[0]).toMatchObject({ date: nextMonth, reason: 'Holiday' });

  const removed = fakeRes();
  await blocked({ method: 'DELETE', headers: admin, body: { date: nextMonth } } as never, removed as never);
  expect(removed.statusCode).toBe(200);
  const after = fakeRes();
  await availability({ method: 'GET', url: `/api/availability?date=${nextMonth}`, headers: {} } as never, after as never);
  expect(JSON.parse(after.body).status).toBe('open');
});

it('lets the desk remove a subscriber on request', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('ADMIN_TOKEN', 'desk-secret');
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    const command = JSON.parse(init.body);
    if (command[0] === 'HGETALL') return { ok: true, json: async () => ({ result: ['alex@example.org', '2026-11-20T10:00:00.000Z'] }) };
    return { ok: true, json: async () => ({ result: 1 }) };
  });
  vi.stubGlobal('fetch', fetch);

  const removed = fakeRes();
  await subscribers({ method: 'DELETE', headers: admin, body: { email: 'Alex@Example.org' } } as never, removed as never);
  expect(removed.statusCode).toBe(200);
  const command = JSON.parse(fetch.mock.calls[0][1].body);
  expect(command).toEqual(['HDEL', 'kc:mailing-list', 'alex@example.org']);

  const invalid = fakeRes();
  await subscribers({ method: 'DELETE', headers: admin, body: { email: 'nope' } } as never, invalid as never);
  expect(invalid.statusCode).toBe(400);

  const denied = fakeRes();
  await subscribers({ method: 'GET', headers: {} } as never, denied as never);
  expect(denied.statusCode).toBe(401);
});

it('offers a Stripe deposit when configured and records the payment on return', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('SITE_URL', 'https://kaysie.sitebuildup.co.uk');
  const booking = { ...valid, id: 'BK-ABC123', status: 'requested', createdAt: '2026-11-20T10:00:00.000Z' };
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).endsWith('/v1/checkout/sessions')) return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) };
    if (String(url).includes('/v1/checkout/sessions/cs_test_1')) return { ok: true, json: async () => ({ payment_status: 'paid', client_reference_id: 'BK-ABC123', amount_total: 55000, metadata: { bookingId: 'BK-ABC123' } }) };
    if (String(url).includes('/v1/checkout/sessions/cs_test_2')) return { ok: true, json: async () => ({ payment_status: 'unpaid', client_reference_id: 'BK-ABC123' }) };
    return { ok: true, json: async () => ({ result: JSON.stringify(booking) }) };
  });
  vi.stubGlobal('fetch', fetch);

  const created = fakeRes();
  await bookings(json(valid), created as never);
  const body = JSON.parse(created.body);
  expect(body.depositUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
  const sessionCall = fetch.mock.calls.find(([u]) => String(u).endsWith('/v1/checkout/sessions'));
  const form = new URLSearchParams(String(sessionCall![1]?.body));
  expect(form.get('line_items[0][price_data][unit_amount]')).toBe('55000');
  expect(form.get('metadata[bookingId]')).toMatch(/^BK-/);

  const paid = fakeRes();
  await deposit({ method: 'GET', url: '/api/deposit?session_id=cs_test_1' } as never, paid as never);
  expect(JSON.parse(paid.body)).toMatchObject({ paid: true, id: 'BK-ABC123', amount: 550 });
  const writes = fetch.mock.calls.filter((call) => String((call[1] as { body?: unknown } | undefined)?.body ?? '').includes(BOOKINGS_KEY));
  expect(writes.some((call) => String((call[1] as { body?: unknown } | undefined)?.body ?? '').includes('depositPaid'))).toBe(true);

  const unpaid = fakeRes();
  await deposit({ method: 'GET', url: '/api/deposit?session_id=cs_test_2' } as never, unpaid as never);
  expect(JSON.parse(unpaid.body)).toEqual({ paid: false });

  const invalid = fakeRes();
  await deposit({ method: 'GET', url: '/api/deposit?session_id=nope' } as never, invalid as never);
  expect(invalid.statusCode).toBe(400);
});

it('publishes future live dates as a calendar feed without contact details', () => {
  const res = fakeRes();
  calendar({ method: 'GET' } as never, res as never);
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Type']).toContain('text/calendar');
  expect(res.body).toContain('BEGIN:VCALENDAR');
  expect(res.body).toContain('BEGIN:VEVENT');
  expect(res.body).toContain('Freight Island');
  expect(res.body).not.toContain('@example.org');
  const rejected = fakeRes();
  calendar({ method: 'POST' } as never, rejected as never);
  expect(rejected.statusCode).toBe(405);
});
