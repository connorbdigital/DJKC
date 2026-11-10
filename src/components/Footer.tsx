import { useState, type FormEvent } from "react";
import { Icon } from "./Icons";
import { Logo } from "./Logo";
import { BOOKING_EMAIL, SOCIALS } from "../data";

export function Footer() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setState("error");
      return;
    }
    setState("done");
  };

  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-night-2/70">
      <p
        aria-hidden="true"
        className="outline-word pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[26vw] font-extrabold leading-none opacity-60 sm:text-[20vw]"
      >
        DJ KC
      </p>

      <div className="relative mx-auto max-w-7xl px-5 pb-36 pt-16 sm:px-8 sm:pb-44 sm:pt-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.2fr_0.7fr_0.7fr_1.2fr]">
          <div>
            <Logo className="text-base text-ink" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-dim">
              House DJ, live vocalist and producer from Cork, Ireland. Filling floors across Ireland, the UK and beyond.
            </p>
            <div className="mt-6 flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.name}
                  className="glass flex h-10 w-10 items-center justify-center rounded-full text-dim transition-all hover:-translate-y-0.5 hover:border-magenta/50 hover:text-magenta"
                >
                  <Icon name={s.icon} className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Footer — explore">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">Explore</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                ["The Sound", "#music"],
                ["Experience", "#experience"],
                ["Live dates", "#shows"],
                ["Pricing", "#pricing"],
                ["FAQ", "#faq"],
                ["Book KC", "#book"],
              ].map(([l, h]) => (
                <li key={h}>
                  <a href={h} className="text-dim transition-colors hover:text-magenta">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer — listen">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">Listen</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {SOCIALS.filter((s) => s.name !== "Instagram" && s.name !== "TikTok")
                .concat([{ name: "Press kit", icon: "download", href: "#music" }])
                .map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target={s.href.startsWith("#") ? undefined : "_blank"}
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1.5 text-dim transition-colors hover:text-cyan"
                    >
                      {s.name}
                      <Icon name="arrowUpRight" className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              <li>
                <a href={`mailto:${BOOKING_EMAIL}`} className="text-dim transition-colors hover:text-amber">
                  {BOOKING_EMAIL}
                </a>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">The mixtape</h3>
            <p className="mt-5 text-sm leading-relaxed text-dim">
              One exclusive mix in your inbox, first Friday of every month. No noise.
            </p>
            {state === "done" ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-mint/40 bg-mint/10 px-4 py-3.5 text-sm font-semibold text-mint" aria-live="polite">
                <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
                You're in. First mix lands Friday.
              </p>
            ) : (
              <form onSubmit={join} className="mt-4" noValidate>
                <div className="flex gap-2">
                  <label htmlFor="nl-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="nl-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setState("idle");
                    }}
                    placeholder="you@nightclub.com"
                    aria-invalid={state === "error"}
                    className={`w-full min-w-0 rounded-full border bg-night/70 px-5 py-3 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-magenta ${
                      state === "error" ? "border-danger/70" : "border-white/10"
                    }`}
                  />
                  <button
                    type="submit"
                    aria-label="Join the mixtape list"
                    className="btn-primary flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-white"
                  >
                    <Icon name="send" className="h-4 w-4" />
                  </button>
                </div>
                {state === "error" && <p className="mt-2 text-xs text-danger">Enter a valid email to join.</p>}
              </form>
            )}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-5 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint sm:text-left">
            © 2026 DJ KC · Cork, Ireland · House that moves rooms
          </p>
          <a
            href="#top"
            aria-label="Back to top"
            className="glass group flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:border-magenta/50 hover:text-magenta"
          >
            <Icon name="arrowRight" className="h-4 w-4 -rotate-90 transition-transform group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}