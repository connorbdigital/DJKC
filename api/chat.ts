import type { IncomingMessage, ServerResponse } from 'node:http';
import { AREA_GROUPS, FAQS, TIERS } from '../src/data.js';

// A coarse cost ceiling per warm instance; use an edge rate limit in production too.
let windowStart = 0;
let requests = 0;
const instructions = `You are DJ KC’s booking assistant. Answer only questions about KC’s services. Use only the catalogue below; if unsure direct the visitor to the booking enquiry. Use concise UK English, plain text and GBP. Never claim a date is free or booked, promise discounts, send emails or request personal or payment details. The enquiry form prepares an email that visitors send themselves.\n${JSON.stringify({packages: TIERS, areas: AREA_GROUPS.map(a => ({name:a.formValue,cities:a.cities})), faqs: FAQS})}`;

/**
 * Two spellings, one key. Vercel holds this one as OPEN_AI_KEY, and a "sensitive"
 * variable cannot be read back — not by the owner, not by the CLI — so renaming it
 * would mean pasting the secret again. Honouring both names is the cheaper fix and
 * the widget starts answering on the next deploy.
 */
const openAiKey = () => process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || '';

export default async function chat(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, {error:'POST required'}); }
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, {error:'Expected JSON'});
  const messages = (req.body as {messages?: unknown} | null)?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 7 || messages.at(-1)?.role !== 'user' ||
      !messages.every(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() && m.content.length <= 1600)) {
    return send(400, {error:'Invalid messages'});
  }
  const key = openAiKey();
  if (!key) return send(503, {error:'AI unavailable'});
  if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); requests = 0; }
  if (requests >= 30) return send(429, {error:'Try again shortly'});
  requests++;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: {Authorization: `Bearer ${key}`, 'Content-Type':'application/json'},
      body: JSON.stringify({model: 'gpt-4o-mini', store: false, max_tokens: 230, messages: [
        {role:'system', content:instructions}, ...messages.map(({role,content}) => ({role,content}))
      ]}),
    });
    if (!response.ok) return send(503, {error:'AI unavailable'});
    const text = (await response.json()).choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return send(503, {error:'AI unavailable'});
    return send(200, {reply: text.trim().slice(0,1600)});
  } catch { return send(503, {error:'AI unavailable'}); }
}
