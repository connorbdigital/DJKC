import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { Logo } from "./Logo";
import { SOCIALS } from "../data";

const LINKS = [
  { id: "music", label: "The Sound" },
  { id: "experience", label: "Experience" },
  { id: "shows", label: "Live" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export function Navbar({
  active,
  playing,
  muted,
  onSound,
}: {
  active: string;
  playing: boolean;
  muted: boolean;
  onSound: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const soundOn = playing && !muted;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? "glass bg-night/75 shadow-[0_12px_40px_-16px_rgba(255,43,214,0.25)]" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Main">
          <a href="#top" className="text-ink transition-colors hover:text-magenta" aria-label="DJ KC — back to top">
            <Logo className="text-sm sm:text-base" />
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  data-active={active === l.id}
                  className={`link-underline font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                    active === l.id ? "text-magenta" : "text-dim hover:text-ink"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={onSound}
              aria-label={soundOn ? "Mute audio" : playing ? "Unmute audio" : "Play KC's demo mix"}
              title={soundOn ? "Mute" : "Sound on"}
              className={`glass flex h-10 w-10 items-center justify-center rounded-full transition-all hover:border-magenta/50 ${
                soundOn ? "text-magenta" : "text-dim hover:text-ink"
              }`}
            >
              {soundOn ? (
                <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
                  <span className="eq-bar w-[3px] rounded-full bg-magenta" style={{ height: "100%", animationDelay: "0ms" }} />
                  <span className="eq-bar w-[3px] rounded-full bg-violet" style={{ height: "100%", animationDelay: "180ms" }} />
                  <span className="eq-bar w-[3px] rounded-full bg-cyan" style={{ height: "100%", animationDelay: "360ms" }} />
                </span>
              ) : (
                <Icon name={muted && playing ? "volumeX" : "volume"} className="h-[18px] w-[18px]" />
              )}
            </button>

            <a
              href="#book"
              className="btn-primary hidden rounded-full px-5 py-2.5 text-sm font-bold text-white sm:inline-flex"
            >
              Book KC
            </a>

            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="glass flex h-10 w-10 items-center justify-center rounded-full text-ink lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* mobile menu */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed inset-0 z-[60] flex flex-col bg-night/95 backdrop-blur-2xl transition-all duration-500 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-[76px] items-center justify-between px-5 sm:px-8">
          <Logo className="text-sm text-ink" />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="glass flex h-10 w-10 items-center justify-center rounded-full text-ink"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col justify-center gap-1 px-8" aria-label="Mobile">
          {[...LINKS, { id: "book", label: "Book KC" }].map((l, i) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={() => setOpen(false)}
              className={`group flex items-center justify-between border-b border-white/5 py-4 font-display text-2xl font-bold uppercase transition-all duration-500 ${
                l.id === "book" ? "text-grad" : "text-ink hover:text-magenta"
              } ${open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
              style={{ transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }}
            >
              {l.label}
              <Icon name="arrowUpRight" className="h-6 w-6 text-faint transition-all group-hover:text-magenta group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          ))}
        </nav>
        <div className="flex items-center justify-between px-8 pb-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-faint">Cork · Ireland</span>
          <div className="flex gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.name}
                className="glass flex h-10 w-10 items-center justify-center rounded-full text-dim transition-colors hover:text-magenta"
              >
                <Icon name={s.icon} className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}