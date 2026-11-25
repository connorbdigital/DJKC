import { afterEach, expect, it, vi } from 'vitest';
import chat from '../api/chat';

async function call(messages: unknown[]) {
  const req = { method:'POST', headers:{'content-type':'application/json'}, body:{messages} };
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
