import { Icon } from "./Icons";

const ITEMS = [
  "Piano House",
  "Live Vocals",
  "Tech House",
  "Afro House",
  "Original Productions",
  "Disco Grooves",
  "Festival Energy",
  "Classic Anthems",
];

export function Marquee() {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {ITEMS.map((it, i) => (
        <span key={i} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-display text-base font-bold uppercase tracking-wide text-ink/80 sm:text-lg">
            {it}
          </span>
          <Icon name="spark" className={`h-3.5 w-3.5 ${i % 2 ? "text-amber" : "text-magenta"}`} />
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative overflow-hidden border-y border-magenta/15 bg-gradient-to-r from-magenta/10 via-violet/10 to-cyan/10 py-4">
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-night to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-night to-transparent" />
    </div>
  );
}