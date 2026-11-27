import { Icon } from "./Icons";
import { Logo } from "./Logo";
import { BOOKING_EMAIL, SOCIALS } from "../data";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-night-2/70">
      <p
        aria-hidden="true"
        className="outline-word pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[26vw] font-extrabold leading-none opacity-60 sm:text-[20vw]"
      >
        DJ KC
      </p>

      <div className="relative mx-auto max-w-7xl px-5 pb-36 pt-16 sm:px-8 sm:pb-44 sm:pt-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.2fr_0.7fr_0.7fr_1.2fr]">
          <div>
            <Logo className="text-base text-ink" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-dim">
              House DJ, live vocalist and producer from the North West, UK. Filling floors across the UK, Ireland and beyond.
            </p>
            <div className="mt-6 flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.name}
                  className="glass flex h-10 w-10 items-center justify-center rounded-full text-dim transition-all hover:-translate-y-0.5 hover:border-magenta/50 hover:text-magenta"
                >
                  <Icon name={s.icon} className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Footer — explore">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">Explore</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                ["The Sound", "#music"],
                ["Experience", "#experience"],
                ["Live dates", "#shows"],
                ["Pricing", "#pricing"],
                ["FAQ", "#faq"],
                ["Book KC", "#book"],
              ].map(([l, h]) => (
                <li key={h}>
                  <a href={h} className="text-dim transition-colors hover:text-magenta">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer — listen">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">Listen</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {SOCIALS.filter((s) => s.name !== "Instagram" && s.name !== "TikTok")
                .concat([{ name: "Booking brief", icon: "download", href: "#booking-brief" }])
                .map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target={s.href.startsWith("#") ? undefined : "_blank"}
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1.5 text-dim transition-colors hover:text-cyan"
                    >
                      {s.name}
                      <Icon name="arrowUpRight" className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              <li>
                <a href={`mailto:${BOOKING_EMAIL}`} className="text-dim transition-colors hover:text-amber">
                  {BOOKING_EMAIL}
                </a>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-faint">Stay in touch</h3>
            <p className="mt-5 text-sm leading-relaxed text-dim">For clips from the booth and news of the next night, follow KC on Instagram.</p>
            <a className="mt-4 inline-block font-semibold text-magenta underline" href={SOCIALS.find(s => s.name === "Instagram")?.href} target="_blank" rel="noreferrer">Follow DJ KC ↗</a>
          </div>
        </div>

        <nav
          aria-label="More about DJ KC"
          className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/5 pt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-faint"
        >
          {[
            ["Prices", "/prices.html"],
            ["What a DJ costs", "/how-much-does-a-dj-cost.html"],
            ["Weddings", "/wedding-dj.html"],
            ["DJ hire Manchester", "/dj-hire-manchester.html"],
            ["Live dates", "/shows.html"],
            ["Questions", "/faq.html"],
            ["Where KC plays", "/coverage.html"],
            ["About KC", "/about.html"],
            ["Occasions", "/event-types.html"],
            ["Birthdays", "/birthday-party-dj.html"],
            ["Corporate", "/corporate-dj.html"],
            ["Christmas parties", "/christmas-party-dj.html"],
            ["Club nights", "/club-night-dj.html"],
            ["Festivals", "/festival-dj.html"],
            ["Proms", "/prom-dj.html"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-magenta">
              {label}
            </a>
          ))}
          <a href="/api/calendar" className="transition-colors hover:text-cyan">
            Calendar feed
          </a>
        </nav>

        <div className="mt-8 flex flex-col items-center justify-between gap-5 sm:flex-row">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-faint sm:text-left">
            © {new Date().getFullYear()} DJ KC · North West, UK · House that moves rooms
          </p>
          <a
            href="#top"
            aria-label="Back to top"
            className="glass group flex h-11 w-11 items-center justify-center rounded-full text-dim transition-all hover:border-magenta/50 hover:text-magenta"
          >
            <Icon name="arrowRight" className="h-4 w-4 -rotate-90 transition-transform group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}