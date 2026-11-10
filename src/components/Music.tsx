import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "./Reveal";
import { Icon } from "./Icons";
import { Logo } from "./Logo";
import { TRACKS, BOOKING_EMAIL } from "../data";
import collage from "../assets/collage.jpg";

function Visualizer({
  playing,
  getAnalyser,
}: {
  playing: boolean;
  getAnalyser: () => AnalyserNode | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const BARS = 48;
    const data = new Uint8Array(128);
    const levels = new Array(BARS).fill(0.06);

    const draw = () => {
      const analyser = getAnalyser();
      if (analyser && playing) analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#ff2bd6");
      grad.addColorStop(0.55, "#a24bff");
      grad.addColorStop(1, "#2bd9ff");
      ctx.fillStyle = grad;
      const bw = w / BARS;
      for (let i = 0; i < BARS; i++) {
        const idx = Math.floor(Math.pow(i / BARS, 1.4) * 100) + 2;
        const target = analyser && playing ? Math.max(0.06, (data[idx] ?? 0) / 255) : 0.06;
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.12);
        const bh = Math.max(2, levels[i] * (h - 4));
        const x = i * bw + bw * 0.18;
        ctx.globalAlpha = 0.35 + levels[i] * 0.65;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, h - bh, bw * 0.64, bh, 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, h - bh, bw * 0.64, bh);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [playing, getAnalyser]);

  return <canvas ref={canvasRef} className="h-16 w-full" aria-hidden="true" />;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function downloadEpk() {
  const text = `DJ KC — PRESS KIT / EPK
========================================
House DJ · Live Vocalist · Producer — Cork, Ireland

BIO
DJ KC blends live vocals, original productions and razor-sharp
club instinct into house sets that keep floors locked from first
drink to last light. 120+ club shows, 250K+ streams on originals,
98% promoter rebook rate.

FORMATS
- Club Night: 2-hour DJ set (piano / tech / Afro / vocal house)
- Signature Live: 3-hour hybrid DJ + live vocal set
- Festival / Takeover: stage shows & curated lineups

TECH RIDER (SUMMARY)
- 2x Pioneer CDJ-2000nxs2 or newer + DJM-900nxs2 (or own controller)
- 2x full-range booth monitors, independently controlled
- 1x wired Shure SM58 + own in-ear monitoring
- Soundcheck: 30 minutes minimum before doors

BOOKINGS
${BOOKING_EMAIL} · response within 24 hours
Travel within Ireland included. UK/EU fly-dates on request.

LINKS
instagram.com/djkcmusic · soundcloud.com/djkcmusic
Full-length mixes & live footage available on request.
`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "DJ-KC-Press-Kit.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function Music({
  trackIndex,
  playing,
  muted,
  volume,
  onSelect,
  onToggle,
  onVolume,
  getAnalyser,
  getElapsed,
}: {
  trackIndex: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  onSelect: (i: number) => void;
  onToggle: () => void;
  onVolume: (v: number) => void;
  getAnalyser: () => AnalyserNode | null;
  getElapsed: () => number;
}) {
  const track = TRACKS[trackIndex];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setElapsed(getElapsed()), 200);
    return () => window.clearInterval(id);
  }, [playing, getElapsed]);

  const cycle = (60 / track.bpm) * 8;
  const loopPct = playing ? ((elapsed % cycle) / cycle) * 100 : 0;

  return (
    <section id="music" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-magenta/12 blur-[120px]"
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-magenta">The sound</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-5xl">
              Press play. <span className="text-grad">Feel the floor.</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 text-dim leading-relaxed">
              A live demo deck built from KC's production style — switch tracks, push the volume, and hear exactly what
              your Saturday night could sound like.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          {/* player */}
          <Reveal scale>
            <div className="ring-grad rounded-[2rem] p-5 sm:p-7">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={collage}
                  alt={`${track.title} artwork — magenta collage`}
                  className="aspect-square w-full object-cover transition-[filter] duration-700"
                  style={{ filter: `hue-rotate(${track.hue}deg) saturate(1.15)` }}
                  width={640}
                  height={640}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/10 to-night/30" />
                <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-3">
                  <Logo className="bg-night/70 text-[11px] text-ink backdrop-blur" />
                  <span className="rounded-full bg-night/70 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-dim backdrop-blur">
                    KC · Original series
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-magenta">{track.mix}</p>
                  <h3 className="mt-1 font-display text-2xl font-extrabold uppercase sm:text-3xl">{track.title}</h3>
                </div>
                {playing && !muted && (
                  <span className="absolute right-5 bottom-5 flex h-9 w-9 items-center justify-center rounded-full bg-magenta text-white shadow-[0_0_24px_rgba(255,43,214,0.8)]">
                    <Icon name="disc" className="animate-spin-slow h-5 w-5" />
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-magenta/40 bg-magenta/10 px-3 py-1 font-mono text-[10px] tracking-widest text-magenta">
                  {track.bpm} BPM
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-widest text-dim">
                  {track.key}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-widest text-dim">
                  {track.duration}
                </span>
                <span className={`ml-auto rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest ${track.tagColor}`}>
                  {track.tag}
                </span>
              </div>

              <div className="mt-4">
                <Visualizer playing={playing && !muted} getAnalyser={getAnalyser} />
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-magenta to-cyan transition-[width] duration-200 ease-linear"
                    style={{ width: `${loopPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[10px] tracking-widest text-faint">
                  <span>{playing ? fmt(elapsed) : "0:00"}</span>
                  <span className="uppercase">{playing ? "● Live loop" : "Demo deck ready"}</span>
                  <span>{track.duration}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={() => onSelect((trackIndex + TRACKS.length - 1) % TRACKS.length)}
                  aria-label="Previous track"
                  className="glass flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:text-ink hover:border-magenta/40"
                >
                  <Icon name="prev" className="h-4 w-4" />
                </button>
                <button
                  onClick={onToggle}
                  aria-label={playing ? "Pause" : "Play"}
                  className="btn-primary flex h-14 w-14 items-center justify-center rounded-full text-white"
                >
                  <Icon name={playing ? "pause" : "play"} className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onSelect((trackIndex + 1) % TRACKS.length)}
                  aria-label="Next track"
                  className="glass flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:text-ink hover:border-magenta/40"
                >
                  <Icon name="next" className="h-4 w-4" />
                </button>

                <div className="ml-auto flex w-32 items-center gap-2.5 sm:w-40">
                  <Icon name={muted ? "volumeX" : "volume"} className="h-4 w-4 shrink-0 text-dim" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => onVolume(Number(e.target.value) / 100)}
                    className="vol w-full"
                    style={{ "--fill": `${volume * 100}%` } as CSSProperties}
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </Reveal>

          {/* tracklist + EPK */}
          <div>
            <Reveal>
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">Latest productions</h3>
                <div className="flex items-center gap-3 text-faint">
                  <span className="font-mono text-[10px] uppercase tracking-widest">Full mixes</span>
                  <a href="https://open.spotify.com/search/DJ%20KC" target="_blank" rel="noreferrer" aria-label="Spotify" className="transition-colors hover:text-mint">
                    <Icon name="spotify" className="h-[18px] w-[18px]" />
                  </a>
                  <a href="https://soundcloud.com/djkcmusic" target="_blank" rel="noreferrer" aria-label="SoundCloud" className="transition-colors hover:text-amber">
                    <Icon name="soundcloud" className="h-[18px] w-[18px]" />
                  </a>
                </div>
              </div>
            </Reveal>

            <div className="mt-5 space-y-3">
              {TRACKS.map((t, i) => {
                const current = i === trackIndex;
                return (
                  <Reveal key={t.id} delay={i * 110}>
                    <button
                      onClick={() => (current ? onToggle() : onSelect(i))}
                      aria-label={current && playing ? `Pause ${t.title}` : `Play ${t.title}`}
                      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 sm:p-5 ${
                        current
                          ? "border-magenta/40 bg-magenta/[0.07] shadow-[0_12px_40px_-16px_rgba(255,43,214,0.4)]"
                          : "border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
                          current ? "bg-magenta text-white" : "bg-white/5 text-dim group-hover:bg-magenta/20 group-hover:text-magenta"
                        }`}
                      >
                        {current && playing ? (
                          <span className="flex h-4 items-end gap-[2.5px]" aria-hidden="true">
                            <span className="eq-bar w-[3px] rounded bg-white" style={{ height: "100%" }} />
                            <span className="eq-bar w-[3px] rounded bg-white" style={{ height: "100%", animationDelay: "160ms" }} />
                            <span className="eq-bar w-[3px] rounded bg-white" style={{ height: "100%", animationDelay: "320ms" }} />
                          </span>
                        ) : (
                          <Icon name="play" className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-bold ${current ? "text-ink" : "text-ink/90"}`}>
                          {t.title}
                          <span className="ml-2 text-sm font-medium text-faint">{t.mix}</span>
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-faint">
                          {t.bpm} BPM · {t.key}
                        </span>
                      </span>
                      <span className={`hidden rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-widest sm:inline-block ${t.tagColor}`}>
                        {t.tag}
                      </span>
                      <span className="font-mono text-xs text-faint">{t.duration}</span>
                    </button>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={200}>
              <div className="glass mt-6 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-bold text-ink">Promoter? Get the full press kit.</p>
                  <p className="mt-1 text-sm text-dim">
                    Bio, tech rider, live footage links and mix archive — everything your booking meeting needs.
                  </p>
                </div>
                <button
                  onClick={downloadEpk}
                  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-amber/50 bg-amber/10 px-6 py-3 text-sm font-bold text-amber transition-all hover:bg-amber hover:text-night"
                >
                  <Icon name="download" className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                  Download EPK
                </button>
              </div>
            </Reveal>

            <Reveal delay={260}>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                ◦ Demo deck streams generative KC-style loops · full records on streaming platforms
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}