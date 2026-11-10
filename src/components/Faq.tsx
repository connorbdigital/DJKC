import { useState } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { FAQS, BOOKING_EMAIL } from "../data";

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="relative border-t border-white/5 bg-night-2/40 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">Before you ask</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-5xl">
              Fair <span className="text-grad">questions</span>.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-sm leading-relaxed text-dim">
              The details promoters and punters actually ask about — riders, genres, travel and how the live vocal thing
              really works.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="glass mt-8 max-w-sm rounded-2xl p-6">
              <p className="flex items-center gap-2.5 font-bold text-ink">
                <Icon name="mail" className="h-4 w-4 text-magenta" />
                Still curious?
              </p>
              <p className="mt-2 text-sm text-dim">
                Ask anything directly —{" "}
                <a href={`mailto:${BOOKING_EMAIL}`} className="font-semibold text-magenta underline-offset-4 hover:underline">
                  {BOOKING_EMAIL}
                </a>
                . Replies within 24 hours, usually faster.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 70}>
                <div
                  className={`rounded-2xl border transition-colors duration-300 ${
                    isOpen ? "border-magenta/35 bg-magenta/[0.04]" : "border-white/8 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className={`font-bold transition-colors sm:text-lg ${isOpen ? "text-ink" : "text-ink/85"}`}>
                      {f.q}
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-400 ${
                        isOpen ? "rotate-45 bg-magenta text-white" : "bg-white/5 text-dim"
                      }`}
                    >
                      <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                  </button>
                  <div id={`faq-panel-${i}`} role="region" className={`acc-body ${isOpen ? "open" : ""}`}>
                    <div className="acc-inner">
                      <p className="px-6 pb-6 text-sm leading-relaxed text-dim sm:text-[15px]">{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}