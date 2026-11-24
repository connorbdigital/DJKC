import { afterEach, expect, it, vi } from 'vitest';
import bookings from '../api/bookings';
import deposit from '../api/deposit';

function fakeRes() {
  const res = { headers: {} as Record<string, string>, statusCode: 0, body: '', setHeader(k: string, v: string) { res.headers[k] = v; }, end(b?: string) { res.body = b ?? ''; } };
  return res;
}
const json = (body: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body }) as never;
const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const base = { name: 'Alex Carter', email: 'alex@example.org', venue: 'Freight Island', area: 'UK — North West', date: nextMonth, message: 'Peak time please.' };

/** Captures the Stripe form bodies and the Redis writes so the numbers can be inspected. */
function stub(capture: { stripe: string[]; redis: string[] }) {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_1');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const target = String(url);
    if (target.includes('api.stripe.com/v1/checkout')) {
      capture.stripe.push(String(init?.body));
      return { ok: true, json: async () => ({ url: 'https://checkout.stripe.test/cs_1' }) };
    }
    if (target.includes('api.stripe.com')) return { ok: true, json: async () => ({ id: 'cs_1', payment_status: 'paid', metadata: { bookingId: 'BK-1', mode: 'deposit', quotedAmount: '900' }, amount_total: 45000 }) };
    capture.redis.push(`${(init?.body as string) ?? ''}`);
    return { ok: true, json: async () => ({ result: 1 }) };
  }));
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('takes a suggested budget and charges half of it as the deposit', async () => {
  const capture = { stripe: [] as string[], redis: [] as string[] };
  stub(capture);
  const res = fakeRes();
  await bookings(json({ ...base, package: 'Festival / Takeover', offer: 900, pay: 'deposit' }), res as never);

  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body);
  expect(body.depositUrl).toBe('https://checkout.stripe.test/cs_1');
  expect(body.amount).toBe(450);
  expect(body.quotedAmount).toBe(900);
  expect(body.mode).toBe('deposit');

  const stripe = new URLSearchParams(capture.stripe[0]);
  expect(stripe.get('line_items[0][price_data][unit_amount]')).toBe('45000');
  expect(stripe.get('metadata[mode]')).toBe('deposit');
  expect(stripe.get('metadata[quotedAmount]')).toBe('900');
  /* Redis commands arrive as JSON arrays; the booking itself is the fourth element. */
  const stored = JSON.parse(JSON.parse(capture.redis[0])[3]);
  expect(stored.quotedAmount).toBe(900);
  expect(stored.offer).toBe(900);
  expect(stored.paymentMode).toBe('deposit');
});

it('charges the whole fee when the enquirer chooses to pay in full', async () => {
  const capture = { stripe: [] as string[], redis: [] as string[] };
  stub(capture);
  const res = fakeRes();
  await bookings(json({ ...base, package: 'Signature Live', pay: 'full' }), res as never);

  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body);
  expect(body.amount).toBe(1100);
  expect(body.mode).toBe('full');
  const stripe = new URLSearchParams(capture.stripe[0]);
  expect(stripe.get('line_items[0][price_data][unit_amount]')).toBe('110000');
  expect(stripe.get('metadata[mode]')).toBe('full');
});

it('lets the suggested budget override the list price', async () => {
  const capture = { stripe: [] as string[], redis: [] as string[] };
  stub(capture);
  const res = fakeRes();
  await bookings(json({ ...base, package: 'Club Night', offer: 400, pay: 'deposit' }), res as never);

  expect(res.statusCode).toBe(201);
  expect(JSON.parse(res.body).amount).toBe(200);
  expect(new URLSearchParams(capture.stripe[0]).get('line_items[0][price_data][unit_amount]')).toBe('20000');
});

it('refuses a budget outside the sane range', async () => {
  stub({ stripe: [], redis: [] });
  for (const offer of [40, 90_000]) {
    const res = fakeRes();
    await bookings(json({ ...base, package: 'Festival / Takeover', offer, pay: 'deposit' }), res as never);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/budget between/);
  }
});

it('will not take payment without a number to charge', async () => {
  stub({ stripe: [], redis: [] });
  const res = fakeRes();
  await bookings(json({ ...base, package: 'Not sure yet', pay: 'deposit' }), res as never);
  expect(res.statusCode).toBe(400);
  expect(JSON.parse(res.body).error).toMatch(/budget/i);
});

it('still accepts a request with no payment and no price', async () => {
  stub({ stripe: [], redis: [] });
  const res = fakeRes();
  await bookings(json({ ...base, package: 'Not sure yet', pay: 'none' }), res as never);
  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body);
  expect(body.ok).toBe(true);
  expect(body.depositUrl).toBeNull();
});

it('records a full payment differently from a deposit on return from Stripe', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_1');
  const writes: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const target = String(url);
    if (target.includes('checkout/sessions/cs_full')) {
      return { ok: true, json: async () => ({ payment_status: 'paid', amount_total: 110000, metadata: { bookingId: 'BK-1', mode: 'full' } }) };
    }
    if (target.includes('api.stripe.com')) return { ok: true, json: async () => ({}) };
    const body = String(init?.body ?? '');
    if (body.includes('HGET')) {
      return { ok: true, json: async () => ({ result: '{"id":"BK-1","name":"Alex","status":"requested","createdAt":"2026-11-20"}' }) };
    }
    writes.push(body);
    return { ok: true, json: async () => ({ result: 1 }) };
  }));

  const res = fakeRes();
  await deposit({ method: 'GET', url: '/api/deposit?session_id=cs_full' } as never, res as never);
  const body = JSON.parse(res.body);
  expect(body.paid).toBe(true);
  expect(body.mode).toBe('full');
  expect(body.label).toBe('Payment received');
  expect(body.amount).toBe(1100);
  const stored = JSON.parse(JSON.parse(writes[0])[3]);
  expect(stored.paymentMode).toBe('full');
  expect(stored.depositAmount).toBe(1100);
});
