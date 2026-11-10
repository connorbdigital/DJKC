export type TrackStyle = "club" | "vocal" | "tech";

export interface Track {
  id: string;
  title: string;
  mix: string;
  bpm: number;
  key: string;
  duration: string;
  tag: string;
  tagColor: string;
  hue: number;
  style: TrackStyle;
  bass: number[]; // 16 steps, 0 = rest, otherwise MIDI note
  chords: number[][]; // one chord per bar (2 bars)
}

export const TRACKS: Track[] = [
  {
    id: "pressure",
    title: "Pressure",
    mix: "Original Mix",
    bpm: 126,
    key: "F min",
    duration: "6:12",
    tag: "Club weapon",
    tagColor: "text-magenta border-magenta/40 bg-magenta/10",
    hue: 0,
    style: "club",
    bass: [41, 0, 0, 41, 0, 0, 41, 0, 41, 0, 0, 41, 0, 44, 0, 46],
    chords: [
      [53, 56, 60, 63],
      [49, 53, 56, 60],
    ],
  },
  {
    id: "golden",
    title: "Golden Hour",
    mix: "Vocal Mix",
    bpm: 124,
    key: "A♭ maj",
    duration: "5:48",
    tag: "Live vocals",
    tagColor: "text-amber border-amber/40 bg-amber/10",
    hue: 78,
    style: "vocal",
    bass: [44, 0, 44, 0, 0, 44, 0, 44, 41, 0, 41, 0, 0, 41, 0, 43],
    chords: [
      [56, 60, 63, 67],
      [53, 56, 60, 63],
    ],
  },
  {
    id: "warehouse",
    title: "Warehouse Heart",
    mix: "Extended Dub",
    bpm: 128,
    key: "C min",
    duration: "7:03",
    tag: "Late-night tool",
    tagColor: "text-cyan border-cyan/40 bg-cyan/10",
    hue: 265,
    style: "tech",
    bass: [0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 36, 36, 0, 36, 39, 34],
    chords: [
      [48, 51, 55, 58],
      [48, 51, 55, 60],
    ],
  },
];

export const VENUES = [
  "EDISON · CORK",
  "THE GRAND SOCIAL",
  "ELECTRIC · CORK",
  "INDEX · DUBLIN",
  "CYPRUS AVENUE",
  "THE ATTIC · LIMERICK",
];

export const STATS = [
  { value: 120, suffix: "+", label: "Club shows played" },
  { value: 250, suffix: "K", label: "Streams on originals" },
  { value: 98, suffix: "%", label: "Promoters rebook" },
  { value: 4, suffix: "", label: "Residencies & takeovers" },
];

export const FEATURES = [
  {
    n: "01",
    icon: "disc",
    title: "Club-ready DJ sets",
    copy: "From warm-up glow to peak-time pressure — KC reads the room in real time and builds an arc your floor can't walk away from. Piano house, tech, Afro and classics, mixed with intent.",
    chips: ["90–180 min sets", "Open-format house", "Peak-time certified"],
    accent: "magenta",
  },
  {
    n: "02",
    icon: "mic",
    title: "Live vocal house",
    copy: "The moment phones come out: KC steps off the decks and sings live over her own productions. One artist, two performers' worth of energy — no backing singer required.",
    chips: ["Live vocals on decks", "Own mic & IEMs", "Signature moments"],
    accent: "amber",
  },
  {
    n: "03",
    icon: "sliders",
    title: "Originals & exclusive edits",
    copy: "Your night gets weapons nobody else has. KC produces her own records and cuts private edits for her sets — so your crowd hears it here first, and comes back chasing it.",
    chips: ["Original productions", "Private club edits", "Remixes on request"],
    accent: "cyan",
  },
];

export const BENEFITS = [
  {
    n: "01",
    title: "A floor that stays full",
    copy: "KC engineers her sets around your room — capacity, crowd, bar peaks and curfew. The result is simple: people stay longer, dance harder and spend more.",
    stat: "+38% avg. bar spend reported by promoters",
  },
  {
    n: "02",
    title: "One booking, three acts",
    copy: "DJ, vocalist and producer in one fee. You're not coordinating three riders and three contracts — you're confirming one professional who over-delivers.",
    stat: "DJ + live vocals + originals in one rider",
  },
  {
    n: "03",
    title: "Promo that pulls a crowd",
    copy: "Every booking comes with custom promo reels, story assets and mix snippets for your channels — shot, cut and delivered two weeks before doors.",
    stat: "Assets delivered 14 days before doors",
  },
  {
    n: "04",
    title: "Zero-drama professionalism",
    copy: "Advanced tech specs, punctual soundcheck, sober focus, clean handovers. KC treats your night like her own brand — because it is.",
    stat: "100% on-time soundchecks, ever",
  },
];

export interface Show {
  day: string;
  date: string;
  iso: string;
  venue: string;
  city: string;
  event: string;
  note: string;
  hot?: boolean;
}

export const SHOWS: Show[] = [
  {
    day: "FRI",
    date: "27 FEB 2026",
    iso: "20260227",
    venue: "The Grand Social",
    city: "Dublin, IE",
    event: "Neon Nights pres. KC",
    note: "Tickets €12",
  },
  {
    day: "SAT",
    date: "14 MAR 2026",
    iso: "20260314",
    venue: "Electric",
    city: "Cork, IE",
    event: "Golden Hour — Live Vocal Set",
    note: "Free before 11",
    hot: true,
  },
  {
    day: "SAT",
    date: "21 NOV 2026",
    iso: "20261121",
    venue: "Edison",
    city: "Cork, IE",
    event: "Playhouse — Guest Set",
    note: "Free entry · 8pm till late",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "KC is the first name on our list now. She took a wet Tuesday in November and turned it into our biggest midweek takings of the year. The live vocal moment at 1am? Unreal.",
    name: "Róisín Maher",
    role: "General Manager · Edison, Cork",
    initials: "RM",
  },
  {
    quote:
      "Most DJs play tracks. KC plays the room. She watched our floor for ten minutes, changed direction completely, and had two hundred people singing a hook they'd never heard before.",
    name: "Darragh Collins",
    role: "Promoter · Neon Nights, Dublin",
    initials: "DC",
  },
  {
    quote:
      "Booked her for a warm-up slot and she made it feel like a headline. Professional advance, flawless soundcheck, and the promo reel she sent sold fifty tickets on its own.",
    name: "Aoife Byrne",
    role: "Owner · The Attic, Limerick",
    initials: "AB",
  },
  {
    quote:
      "We rebook KC before she leaves the building. Crowd feedback is the best we track all season — and her originals are starting to break because of the sets she plays here.",
    name: "Shane O'Leary",
    role: "Booker · Solstice Festival",
    initials: "SO",
  },
];

export interface Tier {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

export const TIERS: Tier[] = [
  {
    name: "Club Night",
    price: "€650",
    unit: "from · per night",
    tagline: "The dancefloor starter. A full DJ set tuned to your room.",
    features: [
      "2-hour headline or warm-up DJ set",
      "Pre-show call & crowd profiling",
      "Promo pack: 1 reel + 3 story cuts",
      "Travel within Ireland included",
      "CDJ-3000 / controller ready",
    ],
    cta: "Book Club Night",
  },
  {
    name: "Signature Live",
    price: "€1,100",
    unit: "from · per night",
    tagline: "The full KC experience — decks, live vocals and originals.",
    features: [
      "3-hour hybrid DJ + live vocal set",
      "Live vocal moments on her originals",
      "Promo pack: 2 reels + story takeover",
      "Custom edit of your event's anthem",
      "Soundcheck & MC coordination",
      "Travel within Ireland included",
    ],
    cta: "Book Signature Live",
    featured: true,
  },
  {
    name: "Festival / Takeover",
    price: "Custom",
    unit: "tailored quote in 24h",
    tagline: "Stage shows, brand nights and full KC-curated takeovers.",
    features: [
      "Festival-length or multi-room sets",
      "Full lineup curation on request",
      "Pro production advance & stage plot",
      "Press kit, interviews & content day",
      "International travel arranged",
    ],
    cta: "Request a quote",
  },
];

export const FAQS = [
  {
    q: "What does KC need on the night?",
    a: "A standard club setup: 2× CDJ-2000nxs2 or newer plus a DJM-900 (or she brings her own controller), 2 quality monitors, and a wired SM58 for the vocal moments. A full tech rider comes with your confirmation — most venues already have everything on the list.",
  },
  {
    q: "What genres does she play?",
    a: "House in its best forms: piano and vocal house, tech house, Afro house and disco-leaning grooves, with classic anthems woven in when the room asks for them. KC tailors every set to your crowd — from soulful early doors to driving 3am pressure.",
  },
  {
    q: "Does she really sing live over her DJ sets?",
    a: "Yes — that's the signature. KC performs live vocals over her own productions mid-set, using her own mic and in-ear monitoring. It's fully live, fully rehearsed, and it's the moment your crowd films and posts.",
  },
  {
    q: "How far in advance should we book?",
    a: "Prime Friday and Saturday dates typically go 6–10 weeks out, and festival season earlier. Midweek and short-notice slots are sometimes available — send the enquiry either way and you'll hear back within 24 hours.",
  },
  {
    q: "Does she travel outside Ireland?",
    a: "Absolutely. Travel within Ireland is included in every fee. UK and EU dates are quoted with flights and accommodation at cost — KC has a compact, airline-friendly setup for fly-dates.",
  },
  {
    q: "Can we hear a full mix before booking?",
    a: "Press play on this page — the demo deck streams KC-style loops built from her productions. Full-length recorded mixes and live footage are in the press kit, sent instantly with any enquiry reply.",
  },
];

export const SOCIALS = [
  { name: "Instagram", icon: "instagram", href: "https://instagram.com/djkcmusic" },
  { name: "SoundCloud", icon: "soundcloud", href: "https://soundcloud.com/djkcmusic" },
  { name: "Spotify", icon: "spotify", href: "https://open.spotify.com/search/DJ%20KC" },
  { name: "TikTok", icon: "tiktok", href: "https://tiktok.com/@djkcmusic" },
];

export const BOOKING_EMAIL = "booking@djkcmusic.com";