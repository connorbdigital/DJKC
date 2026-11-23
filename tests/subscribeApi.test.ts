import { afterEach, expect, it, vi } from 'vitest';
import subscribe, { LIST_KEY } from '../api/subscribe';
import subscribers from '../api/subscribers';

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
const request = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body }) as never;

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('reports unavailable when no store is configured, without calling a provider', async () => {
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const res = fakeRes();
  await subscribe(request({ email: 'alex@example.org' }), res as never);
  expect(res.statusCode).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects invalid addresses and non-JSON bodies', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  for (const email of ['nope', 'a@b', 'x'.repeat(300) + '@example.org', 42, null]) {
    const res = fakeRes();
    await subscribe(request({ email }), res as never);
    expect(res.statusCode).toBe(400);
  }
  const wrongType = { method: 'POST', headers: { 'content-type': 'text/plain' }, body: {} } as never;
  const res = fakeRes();
  await subscribe(wrongType, res as never);
  expect(res.statusCode).toBe(415);
});

it('stores a normalised address and reports existing subscribers honestly', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test/');
  vi.stubEnv('KV_REST_API_TOKEN', 'secret-token');
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 1 }) });
  vi.stubGlobal('fetch', fetch);

  const res = fakeRes();
  await subscribe(request({ email: '  Alex@Example.ORG ' }), res as never);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true, alreadyOnList: false });
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('https://store.test');
  expect(init.headers.Authorization).toBe('Bearer secret-token');
  const command = JSON.parse(init.body);
  expect(command[0]).toBe('HSETNX');
  expect(command[1]).toBe(LIST_KEY);
  expect(command[2]).toBe('alex@example.org');
  expect(new Date(command[3]).toString()).not.toBe('Invalid Date');

  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 0 }) });
  const again = fakeRes();
  await subscribe(request({ email: 'alex@example.org' }), again as never);
  expect(JSON.parse(again.body)).toEqual({ ok: true, alreadyOnList: true });
});

it('fails closed when the store errors', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
  const res = fakeRes();
  await subscribe(request({ email: 'alex@example.org' }), res as never);
  expect(res.statusCode).toBe(503);
});

it('exports the list only to the token holder', async () => {
  vi.stubEnv('SUBSCRIBERS_TOKEN', '');
  const unset = fakeRes();
  await subscribers({ method: 'GET', headers: {} } as never, unset as never);
  expect(unset.statusCode).toBe(503);

  vi.stubEnv('SUBSCRIBERS_TOKEN', 'export-secret');
  vi.stubEnv('KV_REST_API_URL', 'https://store.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: ['alex@example.org', '2026-11-20T10:00:00.000Z'] }) }));

  const denied = fakeRes();
  await subscribers({ method: 'GET', headers: { authorization: 'Bearer wrong' } } as never, denied as never);
  expect(denied.statusCode).toBe(401);

  const allowed = fakeRes();
  await subscribers({ method: 'GET', headers: { authorization: 'Bearer export-secret' } } as never, allowed as never);
  expect(allowed.statusCode).toBe(200);
  expect(allowed.headers['Content-Type']).toContain('text/csv');
  expect(allowed.body).toContain('email,subscribed_at');
  expect(allowed.body).toContain('"alex@example.org"');
});
