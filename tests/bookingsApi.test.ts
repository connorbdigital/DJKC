import { afterEach, expect, it, vi } from 'vitest';
import bookings, { BOOKINGS_KEY } from '../api/bookings';
import availability from '../api/availability';

function fakeRes() {
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: '',
    setHeader: (k: string, v: string) => { res.headers[k] = v; },
    end: (b?: string) => { res.body = b ?? ''; },
  };
  return res;
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body }) as never;
const valid = {
  name: 'Alex Carter', email: 'Alex@Example.org', venue: 'Freight Island', area: 'UK — North West',
  date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  package: 'Signature Live', message: 'Peak-time slot please.',
};
const okStore = () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('rejects incomplete or impossible requests before touching the store', async () => {
  okStore();
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const cases = [
    { ...valid, name: '' },
    { ...valid, email: 'nope' },
    { ...valid, venue: '' },
    { ...valid, date: '2020-01-01' },
    { ...valid, date: '2099-01-01' },
    { ...valid, package: 'Free set' },
    { ...valid, area: 'Mars' },
  ];
  for (const body of cases) {
    const res = fakeRes();
    await bookings(post(body), res as never);
    expect(res.statusCode).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

it('stores a normalised request with a reference and requested status', async () => {
  okStore();
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 1 }) });
  vi.stubGlobal('fetch', fetch);
  const res = fakeRes();
  await bookings(post(valid), res as never);
  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body);
  expect(body.id).toMatch(/^BK-[A-Z0-9]{6}$/);
  expect(body.status).toBe('requested');
  const command = JSON.parse(fetch.mock.calls[0][1].body);
  expect(command[0]).toBe('HSET');
  expect(command[1]).toBe(BOOKINGS_KEY);
  expect(command[2]).toBe(body.id);
  const saved = JSON.parse(command[3]);
  expect(saved).toMatchObject({ email: 'alex@example.org', status: 'requested', package: 'Signature Live' });
  expect(saved.createdAt).toBeTruthy();
});

it('reports unavailable storage instead of accepting an unsaved booking', async () => {
  vi.stubEnv('KV_REST_API_URL', ''); vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const res = fakeRes();
  await bookings(post(valid), res as never);
  expect(res.statusCode).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});

it('guards the list and updates a status for the token holder', async () => {
  okStore();
  const record = { ...valid, email: 'alex@example.org', id: 'BK-ABC123', status: 'requested', createdAt: '2026-11-20T10:00:00.000Z' };
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    const command = JSON.parse(init.body);
    if (command[0] === 'HGET') return { ok: true, json: async () => ({ result: JSON.stringify(record) }) };
    if (command[0] === 'HGETALL') return { ok: true, json: async () => ({ result: ['BK-ABC123', JSON.stringify(record)] }) };
    return { ok: true, json: async () => ({ result: 1 }) };
  });
  vi.stubGlobal('fetch', fetch);

  vi.stubEnv('BOOKINGS_TOKEN', '');
  const unset = fakeRes();
  await bookings({ method: 'GET', headers: {} } as never, unset as never);
  expect(unset.statusCode).toBe(503);

  vi.stubEnv('BOOKINGS_TOKEN', 'desk-secret');
  const denied = fakeRes();
  await bookings({ method: 'GET', headers: { authorization: 'Bearer nope' } } as never, denied as never);
  expect(denied.statusCode).toBe(401);

  const list = fakeRes();
  await bookings({ method: 'GET', headers: { authorization: 'Bearer desk-secret' } } as never, list as never);
  expect(list.statusCode).toBe(200);
  expect(list.body).toContain('BK-ABC123');
  expect(list.body).toContain('Freight Island');

  const patched = fakeRes();
  await bookings({ method: 'PATCH', headers: { authorization: 'Bearer desk-secret', 'content-type': 'application/json' }, body: { id: 'BK-ABC123', status: 'confirmed' } } as never, patched as never);
  expect(patched.statusCode).toBe(200);
  expect(JSON.parse(patched.body).booking.status).toBe('confirmed');

  const badStatus = fakeRes();
  await bookings({ method: 'PATCH', headers: { authorization: 'Bearer desk-secret', 'content-type': 'application/json' }, body: { id: 'BK-ABC123', status: 'paid' } } as never, badStatus as never);
  expect(badStatus.statusCode).toBe(400);
});

it('reports only aggregate availability for a date', async () => {
  okStore();
  const record = (status: string) => JSON.stringify({ id: 'BK-1', date: '2026-12-05', status, name: 'Private', email: 'private@example.org' });
  const run = async (result: string[]) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result }) }));
    const res = fakeRes();
    await availability({ method: 'GET', url: '/api/availability?date=2026-12-05', headers: {} } as never, res as never);
    return JSON.parse(res.body);
  };
  expect(await run([])).toEqual({ date: '2026-12-05', status: 'open' });
  expect(await run(['BK-1', record('requested')])).toEqual({ date: '2026-12-05', status: 'requested' });
  expect(await run(['BK-1', record('confirmed'), 'BK-2', record('requested')])).toEqual({ date: '2026-12-05', status: 'booked' });
  const leak = await run(['BK-1', record('confirmed')]);
  expect(JSON.stringify(leak)).not.toContain('private@example.org');

  const bad = fakeRes();
  await availability({ method: 'GET', url: '/api/availability?date=soon', headers: {} } as never, bad as never);
  expect(bad.statusCode).toBe(400);
});
