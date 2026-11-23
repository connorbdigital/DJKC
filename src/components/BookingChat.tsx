import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TIERS } from '../data';
import { guideFor, quickAnswers } from '../bookingGuide';
import { Logo } from './Logo';
import { Icon } from './Icons';

type Line = { role: 'user' | 'assistant'; label: string; content: string };
const guest = (text: string): Line => ({ role: 'user', label: 'You', content: text });

export function BookingChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const [hint, setHint] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const append = (...next: Line[]) => setLines(prev => [...prev, ...next].slice(-40));
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [lines, busy]);
  useEffect(() => () => request.current?.abort(), []);
  /* Make room for the updates card: withdraw the invitation while it is on screen. */
  useEffect(() => {
    const hide = () => setHint(false);
    window.addEventListener('kc:updates-open', hide);
    return () => window.removeEventListener('kc:updates-open', hide);
  }, []);
  const open = () => { setHint(false); dialog.current?.showModal(); };
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    const question = guest(text);
    setInput(''); append(question); setBusy(true);
    try {
      const response = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'},
        signal: controller.signal, body: JSON.stringify({messages:[...lines.slice(-6), question].map(({role, content}) => ({role,content}))}) });
      if (!response.ok) throw new Error('unavailable');
      const { reply } = await response.json();
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('empty reply');
      append({role:'assistant', label:'AI assistant', content:reply});
    } catch {
      append({role:'assistant', label:'Booking guide · AI unavailable', content:guideFor(text)});
    } finally { clearTimeout(timer); request.current = null; setBusy(false); }
  };

  return <>
    <aside className="kc-chat-launch" aria-label="Booking help">
      {hint && <div className="kc-chat-hint">
        <button onClick={open} className="p-3 text-left"><strong className="block font-display text-sm">Chat to book your date</strong>
          <span className="text-sm text-ink">From {TIERS[0].price} · UK &amp; worldwide</span></button>
        <button className="self-start p-2" onClick={() => setHint(false)} aria-label="Dismiss chat suggestion"><Icon name="x" className="h-4 w-4" /></button>
      </div>}
      <button className="kc-chat-button btn-primary" onClick={open} aria-label="Open booking chat" aria-haspopup="dialog">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20l1.3-4A8.4 8.4 0 1120 12a8 8 0 01-12 6.9L4 20z" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" d="M8.7 11.8h.01m3.3 0h.01m3.3 0h.01"/></svg>
        <span className="font-mono text-xs font-bold uppercase tracking-wider sm:hidden">Chat</span>
      </button>
    </aside>
    <dialog ref={dialog} className="kc-chat-panel" aria-labelledby="kc-chat-title">
      <header className="flex items-center justify-between gap-3 border-b border-magenta/30 p-4">
        <div><div className="flex items-center gap-2"><Logo className="text-[10px] text-ink" /><span className="font-mono text-[10px] uppercase tracking-widest text-cyan">Booking desk</span></div><h2 id="kc-chat-title" className="mt-2 font-display text-base font-bold sm:text-lg">Chat to book your date</h2></div>
        <button className="rounded-full border border-white/20 bg-panel-2 p-3 text-ink hover:border-magenta" aria-label="Close booking chat" onClick={() => dialog.current?.close()}><Icon name="x" className="h-5 w-5" /></button>
      </header>
      <div ref={log} className="min-h-24 flex-1 overflow-y-auto p-4" role="log" aria-label="Booking conversation" aria-live="polite">
        <p className="kc-chat-message">Planning a night? Explore packages and travel, or ask about your event. KC confirms dates by email.</p>
        {lines.map((m,i) => <div key={i} className={`kc-chat-message ${m.role === 'user' ? 'kc-chat-guest' : ''}`}>
          <strong className="block pb-1 font-mono text-[10px] uppercase tracking-wider text-cyan">{m.label}</strong>{m.content}</div>)}
        {busy && <p className="text-sm text-ink">Looking up your question…</p>}
      </div>
      <div className="space-y-3 border-t border-magenta/30 p-4">
        <div className="flex flex-wrap gap-1.5">{Object.entries(quickAnswers).map(([q,a]) => <button key={q} disabled={busy} className="rounded-full border border-magenta/45 bg-panel px-3 py-1.5 text-sm text-ink hover:border-magenta" onClick={() => append(guest(q), {role:'assistant', label:'Booking guide', content:a})}>{q}</button>)}</div>
        <form onSubmit={ask} className="flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-white/25 bg-night px-3 py-2 text-base text-white placeholder:text-dim" aria-label="Your booking question" maxLength={600} placeholder="Ask a booking question…" value={input} onChange={e => setInput(e.target.value)} />
          <button disabled={!input.trim() || busy} className="btn-primary rounded-xl px-4 font-bold text-night disabled:opacity-60">Send</button></form>
        <p className="text-xs leading-relaxed text-ink">Typed questions may be processed by OpenAI. Leave out contact and payment details.</p>
        <a href="#book" className="inline-block font-bold text-white underline decoration-magenta underline-offset-4" onClick={() => dialog.current?.close()}>Continue to booking enquiry →</a>
      </div>
    </dialog>
  </>;
}
