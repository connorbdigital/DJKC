import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { BENEFITS } from "../data";
import crowd from "../assets/crowd.jpg";

export function Benefits() {
  return (
    <section id="why" className="relative border-t border-white/5 bg-night-2/40 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        {/* sticky pitch */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-amber">Why promoters rebook</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-4xl xl:text-5xl">
              Bookings are easy. <span className="text-grad-warm">Rebookings</span> are earned.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-md leading-relaxed text-dim">
              KC doesn't measure a night in tracks played. She measures it in bar takings, crowd videos and the message
              every promoter sends the next morning: <em className="text-ink">"When are you back?"</em>
            </p>
          </Reveal>

          <Reveal delay={300} scale>
            <div className="relative mt-9 overflow-hidden rounded-3xl border border-white/10">
              <img
                src={crowd}
                alt="Packed dancefloor with hands raised under magenta lasers at a DJ KC set"
                className="aspect-[16/10] w-full object-cover transition-transform duration-[2s] hover:scale-105"
                width={1024}
                height={640}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-night/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mint backdrop-blur">
                  ▲ +38% avg. bar spend
                </span>
                <span className="rounded-full bg-night/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim backdrop-blur">
                  2:47 AM · still full
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={380}>
            <a href="#pricing" className="group mt-7 inline-flex items-center gap-2 font-bold text-magenta transition-colors hover:text-ink">
              See packages &amp; fees
              <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </a>
          </Reveal>
        </div>

        {/* benefit rows */}
        <div className="space-y-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.n} delay={i * 90}>
              <article className="group flex gap-5 rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-400 hover:translate-x-1.5 hover:border-magenta/30 hover:bg-white/[0.045] sm:gap-7 sm:p-8">
                <span className="font-display text-2xl font-extrabold text-magenta/50 transition-colors group-hover:text-magenta sm:text-3xl">
                  {b.n}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-ink sm:text-xl">{b.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-dim">{b.copy}</p>
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mint">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
                    {b.stat}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}