import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { TIERS } from "../data";

export function Pricing({ onChoose }: { onChoose: (tier: string) => void }) {
  return (
    <section id="pricing" className="relative overflow-x-clip py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-20 right-[-10rem] h-[26rem] w-[26rem] rounded-full bg-amber/8 blur-[110px]"
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-amber">The fee</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-3xl font-extrabold uppercase sm:text-5xl">
              Pick your <span className="text-grad-warm">night</span>.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 leading-relaxed text-dim">
              Transparent starting fees, no agency middle layer. Every package is confirmed with one call and one
              contract — then KC handles the rest.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3 lg:gap-7">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 130} scale className="h-full">
              <article
                className={`relative flex h-full flex-col rounded-[1.8rem] p-8 transition-all duration-500 ${
                  t.featured
                    ? "ring-grad shadow-[0_30px_80px_-30px_rgba(255,43,214,0.5)] lg:-translate-y-3"
                    : "glass card-hover"
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-night shadow-[0_8px_24px_rgba(255,178,36,0.45)]">
                    ★ Most booked
                  </span>
                )}
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-dim">{t.name}</h3>
                <p className="mt-5 font-display text-4xl font-extrabold text-ink">
                  {t.price}
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">{t.unit}</p>
                <p className="mt-4 text-sm leading-relaxed text-dim">{t.tagline}</p>

                <ul className="mt-7 flex-1 space-y-3.5 border-t border-white/8 pt-7">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-ink/85">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.featured ? "bg-magenta/20 text-magenta" : "bg-mint/12 text-mint"}`}>
                        <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onChoose(t.name)}
                  className={`mt-8 w-full rounded-full py-3.5 text-sm font-bold transition-all ${
                    t.featured
                      ? "btn-primary text-white"
                      : "border border-white/15 text-ink hover:border-magenta/60 hover:bg-magenta/10 hover:text-magenta"
                  }`}
                >
                  {t.cta}
                </button>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-12 text-center text-sm text-dim">
            Travel within Ireland included · 50% deposit secures your date · balance on the night.{" "}
            <a href="#book" className="font-bold text-magenta underline-offset-4 hover:text-ink hover:underline">
              Something custom? Talk to KC →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}