import { useState, type ChangeEvent, type FormEvent } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { BOOKING_EMAIL, SOCIALS, TIERS } from "../data";

const inputCls =
  "w-full rounded-xl border bg-night/70 px-4 py-3.5 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-magenta";

interface FormState {
  name: string;
  email: string;
  venue: string;
  date: string;
  message: string;
}

export function Booking({ tier, onTier }: { tier: string; onTier: (t: string) => void }) {
  const [form, setForm] = useState<FormState>({ name: "", email: "", venue: "", date: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!form.name.trim()) er.name = "Tell KC who's asking";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) er.email = "That email doesn't look right";
    if (!form.venue.trim()) er.venue = "Venue or event name, please";
    setErrors(er);
    if (Object.keys(er).length) return;
    setStatus("sending");
    window.setTimeout(() => setStatus("sent"), 1100);
  };

  const reset = () => {
    setForm({ name: "", email: "", venue: "", date: "", message: "" });
    setStatus("idle");
  };

  const today = new Date().toISOString().split("T")[0];

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
            {status === "sent" ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center text-center" aria-live="polite">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-mint/15 text-mint shadow-[0_0_50px_rgba(62,229,143,0.35)]">
                  <Icon name="check" className="h-9 w-9" strokeWidth={2.4} />
                </span>
                <h3 className="mt-7 font-display text-2xl font-extrabold uppercase">You're on the list.</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-dim">
                  Enquiry received for <strong className="text-ink">{form.venue}</strong>
                  {form.date ? (
                    <>
                      {" "}on <strong className="text-ink">{form.date}</strong>
                    </>
                  ) : null}{" "}
                  — <strong className="text-magenta">{tier}</strong>. KC will reply to{" "}
                  <strong className="text-ink">{form.email}</strong> within 24 hours.
                </p>
                <button
                  onClick={reset}
                  className="mt-8 rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-ink transition-all hover:border-magenta/60 hover:text-magenta"
                >
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold uppercase">Booking enquiry</h3>
                  <span className="rounded-full bg-mint/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-mint">
                    ● 2026 dates open
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
                      className={`${inputCls} ${errors.name ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
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
                      className={`${inputCls} ${errors.email ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-danger">{errors.email}</p>}
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
                      className={`${inputCls} ${errors.venue ? "border-danger/70" : "border-white/10"}`}
                    />
                    {errors.venue && <p className="mt-1.5 text-xs text-danger">{errors.venue}</p>}
                  </div>
                  <div>
                    <label htmlFor="bk-date" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      Date
                    </label>
                    <input
                      id="bk-date"
                      type="date"
                      min={today}
                      value={form.date}
                      onChange={set("date")}
                      className={`${inputCls} border-white/10 [color-scheme:dark]`}
                    />
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
                  disabled={status === "sending"}
                  className="btn-primary mt-7 flex w-full items-center justify-center gap-2.5 rounded-full py-4 text-base font-bold text-white disabled:opacity-70"
                >
                  {status === "sending" ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send enquiry
                      <Icon name="send" className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  No spam. No obligation. Just a fast, honest reply.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}