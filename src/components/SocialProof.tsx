import { useEffect, useRef, useState } from "react";
import { Reveal, useInView } from "./Reveal";
import { STATS, VENUES } from "../data";

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5);
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (!inView || done.current) return;
    done.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const t0 = performance.now();
    const dur = 1500;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {n}
      <span className="text-magenta">{suffix}</span>
    </span>
  );
}

export function SocialProof() {
  return (
    <section className="relative border-y border-white/5 bg-night-2/60 py-14 sm:py-16" aria-label="Trusted by venues">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.35em] text-faint">
            Keeping floors full at
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
            {VENUES.map((v, i) => (
              <li
                key={v}
                className={`whitespace-nowrap text-sm text-faint transition-colors duration-300 hover:text-ink sm:text-base ${
                  i % 3 === 0 ? "font-display font-bold tracking-wide" : i % 3 === 1 ? "font-mono tracking-[0.2em]" : "font-serif italic tracking-widest"
                }`}
              >
                {v}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-6 border-t border-white/5 pt-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="text-center">
              <p className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
                <Counter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-2 text-xs text-dim sm:text-sm">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}