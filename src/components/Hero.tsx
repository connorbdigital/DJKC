import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { Logo } from "./Logo";
import kcDecks from "../assets/kc-decks.jpg";

export function Hero({
  onListen,
  playing,
  trackTitle,
  bpm,
}: {
  onListen: () => void;
  playing: boolean;
  trackTitle: string;
  bpm: number;
}) {
  return (
    <section id="top" className="relative overflow-hidden pt-[130px] pb-16 sm:pt-[150px] sm:pb-24">
      {/* atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="animate-aurora-a absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-magenta/25 blur-[120px]" />
        <div className="animate-aurora-b absolute top-10 right-[-12rem] h-[30rem] w-[30rem] rounded-full bg-violet/25 blur-[120px]" />
        <div className="animate-aurora-a absolute bottom-[-14rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-cyan/12 blur-[110px]" style={{ animationDelay: "-8s" }} />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* copy */}
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2.5 rounded-full glass px-4 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-dim sm:text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-magenta" style={{ animation: "pulse-dot 2s infinite" }} />
              <span className="whitespace-nowrap">
                DJ · Vocalist · Producer<span className="hidden sm:inline"> — Cork, IE</span>
              </span>
            </p>
          </Reveal>

          <Reveal delay={110}>
            <h1 className="mt-7 font-display font-extrabold uppercase leading-[1.04] tracking-tight text-[clamp(2.5rem,7.5vw,4.7rem)]">
              House that
              <br />
              <span className="text-grad">moves</span> rooms<span className="text-magenta">.</span>
            </h1>
          </Reveal>

          <Reveal delay={220}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-dim sm:text-lg">
              DJ KC blends <strong className="font-semibold text-ink">live vocals</strong>, original productions and
              razor-sharp club instinct into house sets that keep your floor locked — from first drink to last light.
            </p>
          </Reveal>

          <Reveal delay={330}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#book"
                className="btn-primary group inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-sm font-bold text-white sm:text-base"
              >
                Book DJ KC
                <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <button
                onClick={onListen}
                className="group inline-flex items-center gap-3 rounded-full glass px-6 py-3.5 text-sm font-semibold text-ink transition-all hover:border-magenta/50 sm:text-base"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-magenta/15 text-magenta transition-all group-hover:bg-magenta group-hover:text-white">
                  <Icon name={playing ? "pause" : "play"} className="h-3.5 w-3.5" />
                </span>
                {playing ? "Pause the sound" : "Hear her sound"}
              </button>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex -space-x-2.5" aria-hidden="true">
                {["from-magenta to-violet", "from-amber to-magenta", "from-cyan to-violet", "from-violet to-magenta"].map(
                  (g, i) => (
                    <span
                      key={i}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-night bg-gradient-to-br ${g} text-[10px] font-extrabold text-night`}
                    >
                      {["EM", "NS", "TA", "SF"][i]}
                    </span>
                  )
                )}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <Icon key={i} name="star" className="h-3.5 w-3.5" />
                  ))}
                  <span className="ml-1.5 font-mono text-xs text-ink">5.0</span>
                </div>
                <p className="mt-0.5 text-xs text-faint">from club managers &amp; promoters across Ireland</p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* visual */}
        <Reveal scale delay={200} className="relative mx-auto w-full max-w-[520px]">
          <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-magenta/20 via-violet/10 to-cyan/15 blur-2xl" />

          {/* spinning vinyl behind */}
          <div
            aria-hidden="true"
            className="animate-spin-slow absolute -top-10 -left-6 hidden h-36 w-36 rounded-full sm:block"
            style={{
              background:
                "repeating-radial-gradient(circle at center, #17091f 0 2px, #241531 2px 4px)",
              boxShadow: "0 0 40px rgba(255,43,214,0.25)",
            }}
          >
            <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-magenta font-display text-[9px] font-extrabold text-night">
              KC
            </span>
          </div>

          <div className="ring-grad relative overflow-hidden rounded-[2rem] p-1.5">
            <div className="relative overflow-hidden rounded-[1.7rem]">
              <img
                src={kcDecks}
                alt="DJ KC performing live on the decks under magenta stage light"
                className="aspect-[4/5] w-full object-cover object-top transition-transform duration-[1.8s] ease-out hover:scale-[1.04]"
                width={832}
                height={1040}
              />
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-night via-night/50 to-transparent" />

              {/* now playing strip */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div>
                  <Logo className="text-[11px] text-ink" />
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-dim">
                    {playing ? "Now on the decks" : "Live from the decks"}
                  </p>
                  {playing && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-magenta">
                      <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
                        <span className="eq-bar w-[2px] bg-magenta" style={{ height: "100%" }} />
                        <span className="eq-bar w-[2px] bg-magenta" style={{ height: "100%", animationDelay: "150ms" }} />
                        <span className="eq-bar w-[2px] bg-magenta" style={{ height: "100%", animationDelay: "300ms" }} />
                      </span>
                      {trackTitle}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-night/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-mint backdrop-blur">
                  ● Booking 2026
                </span>
              </div>
            </div>
          </div>

          {/* floating chips */}
          <div className="animate-floaty absolute -right-3 top-10 sm:-right-7">
            <div className="glass rounded-2xl px-4 py-3 text-center shadow-[0_16px_40px_-12px_rgba(255,43,214,0.4)]">
              <p className="font-display text-xl font-bold text-ink">
                {bpm}
                <span className="ml-1 text-[10px] font-semibold text-magenta">BPM</span>
              </p>
              <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-dim">Peak-time pressure</p>
            </div>
          </div>
          <div className="animate-floaty absolute -left-3 bottom-24 sm:-left-8" style={{ animationDelay: "-3s" }}>
            <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-[0_16px_40px_-12px_rgba(255,178,36,0.35)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 text-amber">
                <Icon name="mic" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-ink">Live vocals</p>
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-dim">On her own tracks</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}