import { useState } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { SHOWS, type Show } from "../data";

function downloadIcs(s: Show) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DJ KC//Live Dates//EN",
    "BEGIN:VEVENT",
    `UID:${s.iso}-djkcmusic@live`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${s.iso}`,
    `SUMMARY:DJ KC — ${s.event} @ ${s.venue}`,
    `LOCATION:${s.venue}\\, ${s.city}`,
    `DESCRIPTION:${s.note}. Doors from 8pm — DJ KC on decks and live vocals.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dj-kc-${s.iso}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function Shows() {
  const [added, setAdded] = useState<Set<string>>(new Set());

  const remind = (s: Show) => {
    downloadIcs(s);
    setAdded((prev) => new Set(prev).add(s.iso));
  };

  return (
    <section id="shows" className="relative overflow-x-clip py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[20rem] w-[40rem] -translate-x-1/2 rounded-full bg-violet/10 blur-[120px]"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">On the road</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="mt-4 font-display text-3xl font-extrabold uppercase sm:text-5xl">
                Catch KC <span className="text-grad">live</span>.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <p className="max-w-sm text-sm leading-relaxed text-dim">
              Listeners — bring the crew. Promoters — this is the room you could be selling out.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 space-y-4">
          {SHOWS.map((s, i) => (
            <Reveal key={s.iso} delay={i * 100}>
              <article
                className={`group grid items-center gap-4 rounded-2xl border p-5 transition-all duration-300 sm:grid-cols-[110px_1fr_auto] sm:gap-6 sm:p-6 ${
                  s.hot
                    ? "border-magenta/35 bg-magenta/[0.05] hover:border-magenta/60"
                    : "border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-baseline gap-3 sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">{s.day}</p>
                  <p className="font-display text-lg font-extrabold leading-tight text-amber sm:mt-1 sm:text-xl">
                    {s.date.split(" ").slice(0, 2).join(" ")}
                    <span className="block text-[11px] font-bold text-faint">{s.date.split(" ")[2]}</span>
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2.5 text-base font-bold text-ink sm:text-lg">
                    {s.event}
                    {s.hot && (
                      <span className="rounded-full bg-amber/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-amber">
                        Live vocal set
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-dim">
                    <Icon name="mapPin" className="h-3.5 w-3.5 text-faint" />
                    {s.venue} · {s.city}
                    <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-widest text-faint sm:inline">
                      {s.note}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => remind(s)}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
                    added.has(s.iso)
                      ? "border border-mint/50 bg-mint/10 text-mint"
                      : "glass text-ink hover:border-cyan/50 hover:text-cyan"
                  }`}
                >
                  <Icon name={added.has(s.iso) ? "check" : "bell"} className="h-4 w-4" />
                  {added.has(s.iso) ? "Reminder saved" : "Remind me"}
                </button>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-8 text-center text-sm text-dim">
            Want KC on your date instead?{" "}
            <a href="#book" className="font-bold text-magenta underline-offset-4 transition-colors hover:text-ink hover:underline">
              Check availability →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}