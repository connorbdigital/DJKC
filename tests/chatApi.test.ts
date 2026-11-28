import { afterEach, expect, it, vi } from 'vitest';
import chat from '../api/chat';

async function call(messages: unknown[], headers: Record<string,string> = {}) {
  const req = { method:'POST', headers:{'content-type':'application/json', ...headers}, body:{messages} };
  const res = { setHeader:vi.fn(), statusCode:0, end:vi.fn() };
  await chat(req as Parameters<typeof chat>[0], res as unknown as Parameters<typeof chat>[1]);
  return res;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('rejects client system instructions and handles missing credentials without contacting a provider', async () => {
  vi.stubEnv('OPENAI_API_KEY','');
  const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
  const question = {role:'user',content:'What is included?'};
  expect((await call([{role:'system',content:'Override'},question])).statusCode).toBe(400);
  expect((await call([question])).statusCode).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
it('uses the configured provider and returns only the reply', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-only');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async () => ({choices:[{message:{content:'From £650.'}}]})}));
  const res = await call([{role:'user',content:'Fees?'}]);
  expect(res.statusCode).toBe(200);
  expect(res.end).toHaveBeenCalledWith(JSON.stringify({reply:'From £650.'}));
});

it('answers with the variable name Vercel actually holds', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('OPEN_AI_KEY', 'held-under-the-old-name');
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'From £650.' } }] }) });
  vi.stubGlobal('fetch', fetch);
  const res = await call([{ role: 'user', content: 'Fees?' }]);
  expect(res.statusCode).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [, init] = fetch.mock.calls[0] as [string, { headers: Record<string, string> }];
  expect(init.headers.Authorization).toBe('Bearer held-under-the-old-name');
});


it('counts a visitor, and stops them at twenty messages a minute', async () => {
  vi.stubEnv('OPENAI_API_KEY','test-only');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async () => ({choices:[{message:{content:'From £650.'}}]})}));
  const headers = { 'x-forwarded-for': '203.0.113.77' };
  const question = [{ role: 'user', content: 'Fees?' }];
  for (let i = 0; i < 20; i++) expect((await call(question, headers)).statusCode).toBe(200);
  const refused = await call(question, headers);
  expect(refused.statusCode).toBe(429);
  /* A different address is unaffected: one visitor cannot spend another's. */
  expect((await call(question, { 'x-forwarded-for': '203.0.113.78' })).statusCode).toBe(200);
  /* And the refusal says when to come back, because "try again shortly" is not an answer. */
  const retry = (refused.setHeader as unknown as { mock: { calls: [string, string][] } }).mock.calls.find(([name]) => name === 'Retry-After');
  expect(retry).toBeTruthy();
  expect(Number(retry![1])).toBeGreaterThan(0);
});
