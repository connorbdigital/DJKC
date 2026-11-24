import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { calendarDate } from "../utils/dates";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { AREA_GROUPS, BOOKING_EMAIL, SOCIALS, TIERS } from "../data";

const inputCls =
  "w-full rounded-xl border bg-night/70 px-4 py-3.5 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-magenta";

interface FormState {
  name: string;
  email: string;
  venue: string;
  area: string;
  date: string;
  message: string;
}

export function Booking({ tier, onTier }: { tier: string; onTier: (t: string) => void }) {
  const [form, setForm] = useState<FormState>({ name: "", email: "", venue: "", area: "", date: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [draft, setDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string; depositUrl?: string | null } | null>(null);
  const [slot, setSlot] = useState<"idle" | "checking" | "open" | "requested" | "booked" | "blocked" | "unknown">("idle");
  const [deposit, setDeposit] = useState<{ id: string; amount: number } | null>(null);

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  /* Ask the booking desk whether the chosen date already has an enquiry or a confirmed show. */
  useEffect(() => {
    if (!form.date || form.date < calendarDate()) {
      setSlot("idle");
      return;
    }
    const controller = new AbortController();
    setSlot("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/availability?date=${form.date}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (controller.signal.aborted) return;
        setSlot(["open", "requested", "booked", "blocked"].includes(data?.status) ? data.status : "unknown");
      } catch {
        if (!controller.signal.aborted) setSlot("unknown");
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [form.date]);

  /* Returning from Stripe: ask the server to verify the session before claiming a payment. */
  useEffect(() => {
    const session = new URLSearchParams(window.location.search).get("deposit");
    if (!session) return;
    let cancelled = false;
    fetch(`/api/deposit?session_id=${encodeURIComponent(session)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.paid) setDeposit({ id: String(data.id ?? ""), amount: Number(data.amount ?? 0) });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!form.name.trim()) er.name = "Tell KC who's asking";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) er.email = "That email doesn't look right";
    if (!form.venue.trim()) er.venue = "Venue or event name, please";
    if (form.date && form.date < calendarDate()) er.date = "Choose today or a future date";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSending(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, venue: form.venue,
          area: form.area, date: form.date, package: tier, message: form.message,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error("not stored");
      setSent({ id: String(result.id), depositUrl: typeof result.depositUrl === "string" ? result.depositUrl : null });
      setSlot("requested");
    } catch {
      /* No booking store reachable: hand over the email draft instead of claiming success. */
      setDraft(true);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSent(null);
    setDeposit(null);
    setDraft(false);
    setForm({ name: "", email: "", venue: "", area: "", date: "", message: "" });
    setSlot("idle");
  };

  const subject = `Booking enquiry: ${form.venue}`;
  const body = [`Name: ${form.name}`, `Reply to: ${form.email}`, `Venue / event: ${form.venue}`,
    ...(form.area ? [`Area: ${form.area}`] : []),
    `Date: ${form.date || "To be confirmed"}`, `Package: ${tier}`, "", form.message].join("\n");

  return (
    <section id="book" className="relative overflow-x-clip py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="animate-aurora-a absolute -top-32 left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-magenta/18 blur-[130px]" />
        <div className="animate-aurora-b absolute bottom-[-12rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-violet/20 blur-[130px]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-start gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div className="lg:sticky lg:top-28">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-magenta">Final call</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[1.05] sm:text-6xl">
              Let's fill
              <br />
              <span className="text-grad">your floor</span>.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-md leading-relaxed text-dim">
              Tell KC about your night — the room, the crowd, the date. You'll get a reply within 24 hours with
              availability, a firm quote and a mix tailored to your floor.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <ul className="mt-8 space-y-4">
              {[
                { icon: "clock", text: "Reply within 24 hours — usually same day" },
                { icon: "check", text: "50% deposit locks the date. Simple one-page contract." },
                { icon: "headphones", text: "Custom preview mix for your event, free with every quote" },
              ].map((x) => (
                <li key={x.text} className="flex items-center gap-3.5 text-sm text-ink/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-magenta/12 text-magenta">
                    <Icon name={x.icon} className="h-4 w-4" />
                  </span>
                  {x.text}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href={`mailto:${BOOKING_EMAIL}`}
                className="inline-flex items-center gap-2 font-mono text-sm text-dim transition-colors hover:text-magenta"
              >
                <Icon name="mail" className="h-4 w-4" />
                {BOOKING_EMAIL}
              </a>
              <span className="hidden h-4 w-px bg-white/10 sm:block" />
              <div className="flex gap-2.5">
                {SOCIALS.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.name}
                    className="glass flex h-10 w-10 items-center justify-center rounded-full text-dim transition-all hover:text-magenta hover:border-magenta/50 hover:-translate-y-0.5"
                  >
                    <Icon name={s.icon} className="h-[18px] w-[18px]" />
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200} scale>
          <div className="ring-grad rounded-[2rem] p-6 sm:p-9">
            {deposit ? (
              <div className="space-y-5">
                <span className="inline-block rounded-full bg-mint/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-mint">
                  Deposit received
                </span>
                <h3 className="font-display text-xl font-bold">Thank you — the deposit is paid.</h3>
                <p className="text-sm leading-relaxed text-dim">
                  {deposit.amount > 0 ? `We received £${deposit.amount.toLocaleString("en-GB")}. ` : ""}
                  {deposit.id ? <>Your booking reference is <strong className="text-ink">{deposit.id}</strong>. </> : null}
                  KC will confirm the date and send the short contract next. Keep this reference for any questions.
                </p>
                <a
                  className="btn-primary inline-block rounded-full px-5 py-3 font-bold text-white"
                  href={`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(`Deposit paid — ${deposit.id}`)}`}
                >
                  Email KC about this booking
                </a>
              </div>
            ) : sent ? (
              <div className="space-y-5">
                <span className="inline-block rounded-full bg-mint/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-mint">
                  Request received
                </span>
                <h3 className="font-display text-xl font-bold">Thanks — KC has your request.</h3>
                <p className="text-sm leading-relaxed text-dim">
                  Your reference is <strong className="text-ink">{sent.id}</strong>. KC replies within 24 hours to confirm
                  the date, fee and travel. Nothing is booked until she confirms in writing.
                </p>
                {sent.depositUrl && (
                  <div className="rounded-2xl border border-magenta/40 bg-magenta/[0.07] p-4">
                    <p className="text-sm font-semibold text-ink">Want to hold the date now?</p>
                    <p className="mt-1 text-sm text-dim">
                      A holding deposit is the fastest way to secure it. Refund terms are set out in the contract KC sends
                      before anything is final.
                    </p>
                    <a className="btn-primary mt-3 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-white" href={sent.depositUrl}>
                      Pay the holding deposit
                    </a>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    className="btn-primary rounded-full px-5 py-3 font-bold text-white"
                    href={`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(`${subject} · ${sent.id}`)}&body=${encodeURIComponent(body)}`}
                  >
                    Email a copy
                  </a>
                  <button onClick={reset} className="underline">Make another enquiry</button>
                </div>
              </div>
            ) : draft ? (
              <div className="space-y-5">
                <h3 className="font-display text-xl font-bold">The booking desk didn&rsquo;t answer.</h3>
                <p className="text-sm text-dim">Your request wasn&rsquo;t sent, so nothing is saved yet. Open your email app and press Send, or copy these details into a message to {BOOKING_EMAIL}.</p>
                <textarea autoFocus readOnly aria-label="Enquiry draft" value={body} rows={8} className={inputCls} />
                <div className="flex flex-wrap gap-4">
                  <a className="btn-primary rounded-full px-5 py-3 font-bold" href={`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Open email app</a>
                  <button onClick={() => setDraft(false)} className="underline">Edit enquiry</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold uppercase">Booking enquiry</h3>
                  <span className="rounded-full bg-mint/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-mint">
                    Booking request
                  </span>
                </div>

                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bk-name" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Your name *
                    </label>
                    <input
                      id="bk-name"
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Alex Doyle"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "bk-name-error" : undefined}
                      className={`${inputCls} ${errors.name ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.name && <p id="bk-name-error" role="alert" className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="bk-email" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Email *
                    </label>
                    <input
                      id="bk-email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@yourvenue.com"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "bk-email-error" : undefined}
                      className={`${inputCls} ${errors.email ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.email && <p id="bk-email-error" role="alert" className="mt-1.5 text-xs text-danger">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="bk-venue" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Venue / event *
                    </label>
                    <input
                      id="bk-venue"
                      value={form.venue}
                      onChange={set("venue")}
                      placeholder="The Warehouse · Galway"
                      aria-invalid={!!errors.venue}
                      aria-describedby={errors.venue ? "bk-venue-error" : undefined}
                      className={`${inputCls} ${errors.venue ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.venue && <p id="bk-venue-error" role="alert" className="mt-1.5 text-xs text-danger">{errors.venue}</p>}
                  </div>
                  <div>
                    <label htmlFor="bk-date" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Date
                    </label>
                    <input
                      id="bk-date"
                      type="date"
                      min={calendarDate()}
                      aria-invalid={!!errors.date}
                      aria-describedby={errors.date ? "bk-date-error" : undefined}
                      value={form.date}
                      onChange={set("date")}
                      className={`${inputCls} border-white/10 [color-scheme:dark]`}
                    />
                    {errors.date && <p id="bk-date-error" role="alert" className="mt-1.5 text-xs text-danger">{errors.date}</p>}
                    {!errors.date && slot !== "idle" && (
                      <p
                        className={`mt-1.5 text-xs ${slot === "booked" || slot === "blocked" ? "text-amber" : slot === "open" ? "text-mint" : "text-dim"}`}
                        role="status"
                      >
                        {slot === "checking" && "Checking that date…"}
                        {slot === "open" && "That date looks open — KC confirms after your request."}
                        {slot === "requested" && "Another enquiry is already in for this date; KC can still fit you in."}
                        {slot === "booked" && "KC already has a confirmed show that day — send your enquiry for alternatives."}
                        {slot === "blocked" && "KC is unavailable that date (booked or away) — pick another or ask for alternatives."}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bk-area" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">Booking area (optional)</label>
                    <select id="bk-area" value={form.area} onChange={set("area")} className={`${inputCls} border-white/10`}>
                      <option value="">Select an area</option>
                      {AREA_GROUPS.map(area => <option key={area.id} value={area.formValue}>{area.formValue}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bk-tier" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Package
                    </label>
                    <div className="relative">
                      <select
                        id="bk-tier"
                        value={tier}
                        onChange={(e) => onTier(e.target.value)}
                        className={`${inputCls} appearance-none border-white/10 pr-10`}
                      >
                        {TIERS.map((t) => (
                          <option key={t.name} value={t.name} className="bg-night text-ink">
                            {t.name} — {t.price} {t.price !== "Custom" ? "from" : ""}
                          </option>
                        ))}
                        <option value="Not sure yet" className="bg-night text-ink">
                          Not sure yet — advise me
                        </option>
                      </select>
                      <Icon name="chevronRight" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-faint" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bk-msg" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Tell KC about the night
                    </label>
                    <textarea
                      id="bk-msg"
                      rows={4}
                      value={form.message}
                      onChange={set("message")}
                      placeholder="Capacity, crowd, set times, the vibe you're chasing…"
                      className={`${inputCls} resize-none border-white/10`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="btn-primary mt-7 w-full rounded-full py-4 text-base font-bold text-white disabled:opacity-70"
                >
                  {sending ? "Sending your request…" : "Send booking request →"}
                </button>
                <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  KC replies within 24 hours · nothing is confirmed until she does
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}