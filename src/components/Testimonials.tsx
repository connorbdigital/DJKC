import { useEffect, useState } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { TESTIMONIALS } from "../data";

const AV = ["from-magenta to-violet", "from-amber to-magenta", "from-cyan to-violet", "from-violet to-magenta"];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = TESTIMONIALS.length;

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % n), 6500);
    return () => window.clearInterval(id);
  }, [paused, index, n]);

  return (
    <section
      id="voices"
      className="relative overflow-hidden border-t border-white/5 bg-night-2/50 py-24 sm:py-32"
      aria-label="Testimonials"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-[-8rem] h-[24rem] w-[24rem] rounded-full bg-magenta/10 blur-[110px]"
      />
      <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
        <div className="text-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-magenta">Word on the floor</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-3xl font-extrabold uppercase sm:text-5xl">
              Promoters keep <span className="text-grad">score</span>.
            </h2>
          </Reveal>
        </div>

        <Reveal delay={200} scale>
          <div
            className="mt-12"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className="overflow-hidden rounded-[2rem]" role="group" aria-roledescription="carousel" aria-label="Promoter testimonials">
              <div
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(-${index * 100}%)` }}
              >
                {TESTIMONIALS.map((t, i) => (
                  <figure
                    key={t.name}
                    aria-hidden={i !== index}
                    className="glass w-full shrink-0 rounded-[2rem] p-8 sm:p-12"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-6xl font-extrabold leading-none text-magenta/40" aria-hidden="true">
                        “
                      </span>
                      <div className="flex gap-1 text-amber" aria-label="5 out of 5 stars">
                        {[...Array(5)].map((_, j) => (
                          <Icon key={j} name="star" className="h-4 w-4" />
                        ))}
                      </div>
                    </div>
                    <blockquote className="mt-4 text-lg font-medium leading-relaxed text-ink sm:text-xl">
                      {t.quote}
                    </blockquote>
                    <figcaption className="mt-8 flex items-center gap-4">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${AV[i % AV.length]} font-display text-sm font-extrabold text-night`}
                        aria-hidden="true"
                      >
                        {t.initials}
                      </span>
                      <span>
                        <span className="block font-bold text-ink">{t.name}</span>
                        <span className="block text-sm text-dim">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="mt-7 flex items-center justify-center gap-5">
              <button
                onClick={() => setIndex((index - 1 + n) % n)}
                aria-label="Previous testimonial"
                className="glass flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:border-magenta/50 hover:text-ink"
              >
                <Icon name="chevronLeft" className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2" role="tablist" aria-label="Choose testimonial">
                {TESTIMONIALS.map((t, i) => (
                  <button
                    key={t.name}
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Testimonial ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all duration-400 ${
                      i === index ? "w-7 bg-magenta" : "w-2 bg-white/15 hover:bg-white/35"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setIndex((index + 1) % n)}
                aria-label="Next testimonial"
                className="glass flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:border-magenta/50 hover:text-ink"
              >
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}