import { EVENT_TYPES } from "../eventTypes";
import { Reveal } from "./Reveal";

/**
 * The occasions block.
 *
 * The homepage used to say "weddings and parties" and leave the rest to the
 * reader's imagination. Each of these is a different buyer with a different
 * question, and each has its own crawlable page — so the homepage names them,
 * prices them and links them, which is what turns a phrase into a page that can
 * rank for it.
 */
const OCCASIONS = [
  { id: "wedding-dj", nav: "Weddings", blurb: "Drinks reception to last dance, first dance handled, mic for speeches.", price: "from £1,100" },
  ...EVENT_TYPES.map((entry) => ({
    id: entry.id,
    nav: entry.nav,
    blurb: entry.answer.split(". ").slice(0, 1).join(".") + ".",
    price: entry.fromLabel,
  })),
];

export function Occasions() {
  return (
    <section id="occasions" className="relative overflow-x-clip py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-magenta">Occasions</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-5xl">
                Every kind of
                <br />
                <span className="text-grad">booking</span>.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={200} className="max-w-md">
            <p className="text-dim leading-relaxed">
              A wedding is not a birthday and a club night is not a Christmas do. Each one has its own page with the
              real numbers, what is included and the questions people actually ask.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OCCASIONS.map((occasion, index) => (
            <Reveal key={occasion.id} delay={index * 60} scale>
              <li className="h-full">
                <a
                  href={`/${occasion.id}.html`}
                  className="group glass card-hover flex h-full flex-col rounded-2xl p-6 transition-colors hover:border-magenta/40"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-magenta/80">{occasion.price}</span>
                  <h3 className="mt-3 font-display text-base font-bold uppercase tracking-wide text-ink">{occasion.nav}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-dim">{occasion.blurb}</p>
                  <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-dim transition-colors group-hover:text-magenta">
                    Read the page →
                  </span>
                </a>
              </li>
            </Reveal>
          ))}
        </ul>

        <p className="mt-8 text-sm text-dim">
          Not sure which one fits? <a className="text-magenta underline-offset-4 hover:underline" href="#book">Send the date and the venue</a> — the answer comes back within 24 hours with the package that suits, not the nearest template.
        </p>
      </div>
    </section>
  );
}
