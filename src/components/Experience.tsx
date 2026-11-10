import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { FEATURES } from "../data";

const ACCENT: Record<string, { tile: string; num: string; glow: string }> = {
  magenta: { tile: "bg-magenta/12 text-magenta", num: "text-magenta/70", glow: "group-hover:shadow-[0_0_50px_-12px_rgba(255,43,214,0.5)]" },
  amber: { tile: "bg-amber/12 text-amber", num: "text-amber/70", glow: "group-hover:shadow-[0_0_50px_-12px_rgba(255,178,36,0.5)]" },
  cyan: { tile: "bg-cyan/12 text-cyan", num: "text-cyan/70", glow: "group-hover:shadow-[0_0_50px_-12px_rgba(43,217,255,0.5)]" },
};

export function Experience() {
  return (
    <section id="experience" className="relative overflow-x-clip py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-[-10rem] h-[26rem] w-[26rem] rounded-full bg-violet/12 blur-[110px]"
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-magenta">The experience</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-5xl">
                One artist.
                <br />
                Three <span className="text-grad">weapons</span>.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={200} className="max-w-md">
            <p className="text-dim leading-relaxed">
              Most bookings give you a DJ. KC gives your night a performer, a voice and a catalogue — three reasons for
              the crowd to stay, sing and come back.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => {
            const a = ACCENT[f.accent];
            return (
              <Reveal key={f.n} delay={i * 130} scale>
                <article className={`group glass card-hover relative h-full overflow-hidden rounded-3xl p-8 ${a.glow}`}>
                  <span className={`absolute right-6 top-5 font-display text-5xl font-extrabold text-white/5 transition-colors duration-500 group-hover:text-white/10`}>
                    {f.n}
                  </span>
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.tile} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon name={f.icon} className="h-7 w-7" strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-6 font-display text-lg font-bold uppercase tracking-wide">{f.title}</h3>
                  <p className="mt-3.5 text-sm leading-relaxed text-dim">{f.copy}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {f.chips.map((c) => (
                      <li key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-dim transition-colors group-hover:border-white/20">
                        {c}
                      </li>
                    ))}
                  </ul>
                  <span className={`mt-7 block font-mono text-[10px] uppercase tracking-[0.3em] ${a.num}`}>
                    {f.n} / KC
                  </span>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={150}>
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-5">
            {["CDJ-3000 ready", "Own vocal mic & IEMs", "90–180 minute sets", "B2B friendly", "Full tech rider provided"].map((c) => (
              <li key={c} className="flex items-center gap-2 text-xs font-semibold text-dim sm:text-sm">
                <Icon name="check" className="h-4 w-4 text-mint" strokeWidth={2.4} />
                {c}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}