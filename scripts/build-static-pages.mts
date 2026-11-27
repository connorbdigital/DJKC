/**
 * Builds the crawlable half of the site.
 *
 * The homepage is a React app, so its words only exist after JavaScript runs.
 * Search engines cope with that; most AI crawlers do not. This script writes
 * plain HTML versions of the facts people (and answer engines) actually need —
 * prices, dates, FAQs, coverage — plus a sitemap and an llms.txt summary.
 *
 * Runs after `vite build` (see package.json "postbuild") and writes into dist/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CANONICAL_DESCRIPTION,
  EVENT_HUB,
  EVENT_TYPES,
  siblingsOf,
  type EventType,
} from '../src/eventTypes.ts';
import {
  AREA_GROUPS,
  BOOKING_EMAIL,
  DEPOSIT_PERCENT,
  FAQS,
  FEATURES,
  SHOWS,
  SOCIALS,
  TESTIMONIALS,
  TIERS,
} from '../src/data.ts';

const SITE = (process.env.SITE_URL || 'https://kaysie.sitebuildup.co.uk').replace(/\/$/, '');
const OUT = path.resolve('dist');
const STAMP = new Date().toISOString().slice(0, 10);
const STAMP_HUMAN = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const esc = (value: string) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const json = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

const PAGES = [
  { href: '/prices.html', label: 'Prices' },
  { href: '/how-much-does-a-dj-cost.html', label: 'What a DJ costs' },
  { href: '/wedding-dj.html', label: 'Weddings' },
  { href: '/dj-hire-manchester.html', label: 'DJ hire Manchester' },
  { href: '/shows.html', label: 'Live dates' },
  { href: '/faq.html', label: 'Questions' },
  { href: '/coverage.html', label: 'Where KC plays' },
  { href: '/about.html', label: 'About KC' },
  { href: '/event-types.html', label: 'Occasions' },
];

const STYLES = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0A0512;color:#F5EFFA;font:16px/1.65 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#FF2BD6}
a:hover{color:#fff}
.wrap{max-width:880px;margin:0 auto;padding:28px 20px 72px}
.top{display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:18px;margin-bottom:34px}
.logo{font:900 15px/1 "Arial Black",Arial,sans-serif;letter-spacing:.18em;color:#fff;border:2px solid #FF2BD6;padding:9px 11px;text-decoration:none;display:inline-block}
nav{display:flex;flex-wrap:wrap;gap:16px;font-size:13px}
nav a{color:#C9BBD8;text-decoration:none}
nav a:hover,nav a[aria-current]{color:#FF2BD6}
.eyebrow{font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.35em;text-transform:uppercase;color:#FF2BD6;margin:0 0 14px}
h1{font:800 clamp(30px,6vw,50px)/1.05 Manrope,system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 18px;text-transform:uppercase}
h2{font:800 22px/1.2 Manrope,system-ui,sans-serif;margin:40px 0 12px}
h3{font:700 17px/1.3 Manrope,system-ui,sans-serif;margin:22px 0 8px}
p{color:#D6C9E4;margin:0 0 14px;max-width:68ch}
ul{color:#D6C9E4;padding-left:20px;max-width:68ch}
li{margin:0 0 8px}
.lede{font-size:18px;color:#EDE3F7}
.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:20px;margin:16px 0;background:rgba(255,255,255,.03)}
.card.featured{border-color:rgba(255,43,214,.55);background:rgba(255,43,214,.07)}
.price{font:800 26px/1 Manrope,system-ui,sans-serif;color:#fff}
.unit{font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#9B8AB0}
table{width:100%;border-collapse:collapse;margin:12px 0 8px;font-size:15px}
th,td{text-align:left;padding:11px 10px;border-bottom:1px solid rgba(255,255,255,.12);vertical-align:top}
th{font:500 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#9B8AB0}
td a{color:#F5EFFA}
.cta{display:inline-block;margin:26px 0 6px;background:linear-gradient(100deg,#FF2BD6,#8C5BFF);color:#fff;text-decoration:none;font-weight:800;padding:15px 26px;border-radius:999px}
.foot{margin-top:52px;border-top:1px solid rgba(255,255,255,.12);padding-top:20px;font-size:13px;color:#9B8AB0}
.foot a{color:#C9BBD8}
.muted{color:#9B8AB0;font-size:13px}
@media (max-width:600px){
  table,tbody,tr,td{display:block;width:100%}
  thead{display:none}
  tr{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 14px;margin:0 0 12px}
  td{border:0;padding:8px 0;display:block;text-align:left}
  td::before{content:attr(data-label);display:block;margin-bottom:3px;font:500 10px/1.5 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#9B8AB0}
  td + td{border-top:1px solid rgba(255,255,255,.07)}
  td:last-child{border-bottom:0}
}
`;

function shell(opts: { title: string; description: string; slug: string; body: string; schema?: unknown[] }) {
  const url = `${SITE}${opts.slug}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="DJ KC" />
<meta property="og:locale" content="en_GB" />
<meta property="og:title" content="${esc(opts.title)}" />
<meta property="og:description" content="${esc(opts.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#0A0512" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"DJ KC","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"${esc(opts.title.split('—')[0].trim())}","item":"${url}"}]}</script>
${(opts.schema ?? []).map((block) => json(block)).join('\n')}
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="logo" href="/">DJ KC</a>
    <nav aria-label="Site">
      <a href="/">Home</a>
      ${PAGES.map((p) => `<a href="${p.href}"${p.href === opts.slug ? ' aria-current="page"' : ''}>${p.label}</a>`).join('\n      ')}
    </nav>
  </header>
  <main>
${opts.body}
  </main>
  <footer class="foot">
    <p><strong>DJ KC</strong> — house DJ, live vocalist and producer based in the North West of England, playing across the UK, Ireland and internationally.</p>
    <p>Bookings: <a href="mailto:${BOOKING_EMAIL}">${BOOKING_EMAIL}</a> · <a href="/#book">Send a booking request</a> · ${SOCIALS.map((s) => `<a href="${s.href}" rel="me noreferrer">${s.name}</a>`).join(' · ')}</p>
    <p class="muted">Club sets from £650 · ${DEPOSIT_PERCENT}% deposit holds a date · Replies within 24 hours.</p>
  </footer>
</div>
</body>
</html>
`;
}

const bookingCta = `<a class="cta" href="/#book">Check a date with KC →</a>`;

/* ---------- prices ---------- */
const tierBody = TIERS.map((t) => `
      <div class="card${t.featured ? ' featured' : ''}">
        <p class="price">${esc(t.price)}</p>
        <p class="unit">${esc(t.unit)}</p>
        <h2 style="margin-top:10px">${esc(t.name)}</h2>
        <p>${esc(t.tagline)}</p>
        <ul>${t.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      </div>`).join('');

const offers = TIERS.filter((t) => /\d/.test(t.price)).map((t) => ({
  '@type': 'Offer',
  name: t.name,
  description: t.tagline,
  price: t.price.replace(/[^\d.]/g, ''),
  priceCurrency: 'GBP',
  availability: 'https://schema.org/InStock',
  url: `${SITE}/prices.html`,
  itemOffered: { '@type': 'Service', name: `DJ KC — ${t.name}`, serviceType: 'DJ and live vocal performance', areaServed: ['North West England', 'United Kingdom', 'Ireland'] },
}));

const pricesHtml = shell({
  title: 'DJ KC prices — club nights, live vocals and festival sets from £650',
  description: 'What DJ KC costs: club nights from £650, the Signature Live DJ plus live vocal show from £1,100, festival and takeover sets quoted in 24 hours. Travel across the North West is included; a 50% deposit holds the date.',
  slug: '/prices.html',
  body: `
      <p class="eyebrow">Prices · GBP</p>
      <h1>What a night with KC costs</h1>
      <p class="lede">Straight numbers, no enquiry wall. Club nights start at £650, the full DJ-plus-live-vocals show starts at £1,100, and bigger takeovers are quoted within 24 hours. All prices are in pounds sterling and include travel across the North West of England.</p>
      ${tierBody}
      <h2>Paying</h2>
      <p>A ${DEPOSIT_PERCENT}% deposit holds your date, with the balance due before the event; you can also pay the fee in full up front. Card payments run through Stripe at the end of the booking form, and refund terms are set out in the one-page contract KC sends before you pay.</p>
      <p>Have a number in mind? The booking form lets you suggest your own budget for a custom or unsure package, and KC confirms or counters within 24 hours. Nothing is fixed until she replies in writing.</p>
      <h2>Travel and areas</h2>
      <p>Travel is included across the North West: Manchester, Liverpool, Preston, Blackpool, Bolton, Chester, Warrington and Stockport. Elsewhere in the UK, in Ireland and internationally, travel and accommodation are quoted at cost on a compact, airline-friendly rig. <a href="/coverage.html">See the full coverage list</a>.</p>
      ${bookingCta}
      <p class="muted">Prices shown are starting points for standard club and private bookings. Weddings, festivals, brand events and multi-room takeovers are quoted individually.</p>`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'DJ KC booking prices',
      url: `${SITE}/prices.html`,
      itemListElement: offers,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DJ KC — house DJ and live vocalist for hire',
      serviceType: 'House DJ, live vocalist and event entertainment',
      provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/` },
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'North West England' },
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'Ireland' },
        { '@type': 'Place', name: 'Ibiza, Spain' },
      ],
      offers: { '@type': 'AggregateOffer', lowPrice: '650', highPrice: '1100', priceCurrency: 'GBP', offerCount: String(offers.length) },
    },
  ],
});

/* ---------- faq ---------- */
const faqHtml = shell({
  title: 'DJ KC — booking questions answered (travel, kit, genres, deposits)',
  description: 'Answers to the questions promoters and couples ask DJ KC: what kit she needs, which genres she plays, whether the vocals are live, how far ahead to book, how far she travels, and how deposits work.',
  slug: '/faq.html',
  body: `
      <p class="eyebrow">Questions</p>
      <h1>Everything asked before booking</h1>
      <p class="lede">The short answers, in plain English. If yours isn't here, email <a href="mailto:${BOOKING_EMAIL}">${BOOKING_EMAIL}</a> and you'll hear back within 24 hours.</p>
      ${FAQS.map((f, i) => `
      <h2 id="q${i + 1}">${esc(f.q)}</h2>
      <p>${esc(f.a)}</p>`).join('')}
      <h2>How do deposits and payment work?</h2>
      <p>A ${DEPOSIT_PERCENT}% deposit holds the date, or you can pay the fee in full up front. Payment is taken by card through Stripe at the end of the booking form; the confirmation email carries your booking reference. Refund terms are set out in the one-page contract KC sends before you pay.</p>
      <h2>Can I suggest my own budget?</h2>
      <p>Yes. If the packages don't fit, choose a custom or unsure option in the booking form and name the number your budget allows. KC confirms or counters within 24 hours — nothing is charged until you both agree.</p>
      ${bookingCta}`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
});

/* ---------- shows ---------- */
const isoOf = (show: (typeof SHOWS)[number]) =>
  show.startsAt ?? `${show.iso.slice(0, 4)}-${show.iso.slice(4, 6)}-${show.iso.slice(6, 8)}`;

const showsHtml = shell({
  title: 'DJ KC live dates — club nights in Manchester, Liverpool, London, Cork and Dublin',
  description: 'Where DJ KC is playing next: club nights, live vocal sets and festival slots across the North West, London, Ireland and Ibiza, with venue, city and ticket notes.',
  slug: '/shows.html',
  body: `
      <p class="eyebrow">Live dates</p>
      <h1>Where KC is playing next</h1>
      <p class="lede">Club nights, live vocal sets and festival stages across the UK, Ireland and beyond. Want her on your date? <a href="/#book">Send a request</a> — unlisted nights are usually still open.</p>
      <table>
        <thead><tr><th>Date</th><th>Venue</th><th>Event</th><th>Notes</th></tr></thead>
        <tbody>
${SHOWS.map((s) => `          <tr>
            <td data-label="Date">${esc(`${s.day} ${s.date}`)}${s.area ? `<div class="muted">${esc(s.area)}</div>` : ''}</td>
            <td data-label="Venue"><strong>${esc(s.venue)}</strong><div class="muted">${esc(s.city)}</div></td>
            <td data-label="Event">${esc(s.event)}</td>
            <td data-label="Notes" class="muted">${esc(s.note)}</td>
          </tr>`).join('\n')}
        </tbody>
      </table>
      <p class="muted">Dates are listed in venue-local time. Subscribe to the <a href="/api/calendar">calendar feed</a> to keep them in your diary.</p>
      ${bookingCta}`,
  schema: SHOWS.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: `${s.event} — DJ KC`,
    startDate: isoOf(s),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${SITE}/shows.html`,
    location: { '@type': 'Place', name: s.venue, address: { '@type': 'PostalAddress', addressLocality: s.city.split(',')[0] } },
    performer: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/` },
    description: `${s.event} at ${s.venue}, ${s.city}. ${s.note}.`,
  })),
});

/* ---------- coverage ---------- */
const coverageHtml = shell({
  title: 'Where DJ KC plays — DJ hire in Manchester, Liverpool, London, Ireland and Europe',
  description: 'DJ KC covers the North West of England as home turf, plus London, the rest of the UK, Ireland (Cork, Dublin, Limerick, Galway, Belfast) and international dates. Travel is included across the North West and quoted at cost elsewhere.',
  slug: '/coverage.html',
  body: `
      <p class="eyebrow">Where KC plays</p>
      <h1>UK, Ireland and international dates</h1>
      <p class="lede">Based in the North West of England, on the road most weekends. Manchester and Liverpool anchor the month; London, Ireland and Europe sit on the same routing, which keeps travel quotes sensible.</p>
${AREA_GROUPS.map((a) => `
      <div class="card${a.featured ? ' featured' : ''}">
        <h2 style="margin-top:0">${esc(a.name)}</h2>
        <p>${esc(a.blurb)}</p>
        <p class="muted">Cities covered: ${esc(a.cities.join(' · '))}</p>
      </div>`).join('')}
      <h2>How travel is quoted</h2>
      <p>Across the North West — Manchester, Liverpool, Preston, Blackpool, Bolton, Chester, Warrington, Stockport — travel is included in the quoted fee. Elsewhere in the UK, in Ireland and internationally, travel and accommodation are quoted at cost and shown separately, using a compact fly-rig that fits airline baggage limits.</p>
      <p>Ireland and other euro-zone dates can be quoted in euro on request; UK dates are always in pounds sterling.</p>
      ${bookingCta}`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'PerformingGroup',
      name: 'DJ KC',
      url: `${SITE}/`,
      description: 'House DJ, live vocalist and producer based in the North West of England, available across the UK, Ireland and internationally.',
      areaServed: AREA_GROUPS.flatMap((a) => [
        { '@type': 'AdministrativeArea', name: a.name },
        ...a.cities.map((city) => ({ '@type': 'City', name: city })),
      ]),
      sameAs: SOCIALS.map((s) => s.href),
    },
  ],
});

/* ---------- about ---------- */
const aboutHtml = shell({
  title: 'About DJ KC — house DJ, live vocalist and producer from the North West',
  description: 'DJ KC is a house DJ, live vocalist and producer based in the North West of England. Club-ready house sets, live vocals over her own productions, and a promo pack with every booking.',
  slug: '/about.html',
  body: `
      <p class="eyebrow">About</p>
      <h1>One artist, three acts</h1>
      <p class="lede">DJ KC is a house DJ, live vocalist and producer based in the North West of England. She plays club nights, festivals and private events across the UK and Ireland, with international dates on the same routing.</p>
      <p>Her sets sit in house in its best forms — piano and vocal house, tech house, Afro house and disco-leaning grooves — read live off the room rather than planned in advance. Mid-set she steps off the decks and sings over her own productions, which is the moment most crowds film.</p>
      <p>She produces her own records and cuts private edits for her sets, so the floor hears things nobody else is playing yet.</p>
      <h2>What a booking includes</h2>
${FEATURES.map((f) => `
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.copy)}</p>`).join('')}
      <h2>What promoters say</h2>
${TESTIMONIALS.slice(0, 3).map((t) => `
      <blockquote class="card"><p>“${esc(t.quote)}”</p><p class="muted">${esc(t.name)} — ${esc(t.role)}</p></blockquote>`).join('')}
      <h2>Where she plays</h2>
      <p>Home turf is the North West: Manchester, Liverpool, Preston, Blackpool, Bolton, Chester, Warrington and Stockport. Beyond that, London and the South East, the rest of the UK, Ireland (Cork, Dublin, Limerick, Galway, Belfast) and international dates including Ibiza. <a href="/coverage.html">Full coverage list</a>.</p>
      <p>Prices start at £650 for a club night and £1,100 for the Signature Live show. <a href="/prices.html">See prices</a>.</p>
      ${bookingCta}`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'PerformingGroup',
      name: 'DJ KC',
      alternateName: 'DJ KC Music',
      url: `${SITE}/`,
      image: `${SITE}/og.jpg`,
      description: 'House DJ, live vocalist and producer based in the North West of England, playing club nights, festivals and private events across the UK, Ireland and internationally.',
      genre: ['House', 'Vocal house', 'Tech house', 'Afro house'],
      email: BOOKING_EMAIL,
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'North West England' },
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'Ireland' },
        { '@type': 'Place', name: 'Ibiza, Spain' },
      ],
      sameAs: SOCIALS.map((s) => s.href),
    },
  ],
});


/* ---------- what a DJ costs ---------- */
const costHtml = shell({
  title: 'How much does a DJ cost in the UK? 2026 price guide · DJ KC',
  description: 'What a DJ actually costs in the UK: typical ranges for party DJs (£450–£900), wedding DJs (£600–£1,400) and DJs who sing live (£1,000–£1,900), what changes the price, and what DJ KC charges from the North West.',
  slug: '/how-much-does-a-dj-cost.html',
  body: `
      <p class="eyebrow">Price guide · GBP</p>
      <h1>How much does a DJ cost in the UK?</h1>
      <p class="lede">Short answer: most UK party DJs charge <strong>£450–£900</strong> a night, wedding DJs <strong>£600–£1,400</strong>, and a DJ who also sings live <strong>£1,000–£1,900</strong>. The spread is real — it reflects experience, hours, distance, the day of the week and how much equipment is included.</p>
      <p>These ranges are the published averages from UK booking platforms and agency price guides. They are useful as a benchmark, not a quote: what matters is comparing like with like.</p>

      <h2>Typical UK DJ prices by type</h2>
      <table>
        <thead><tr><th>Booking type</th><th>Typical range</th><th>What that usually buys</th></tr></thead>
        <tbody>
          <tr><td data-label="Booking type">House party / small birthday</td><td data-label="Typical range">£150–£400</td><td data-label="What that buys">3–4 hours, basic rig, one DJ reading the room</td></tr>
          <tr><td data-label="Booking type">Party or function DJ</td><td data-label="Typical range">£450–£900</td><td data-label="What that buys">4–5 hours, PA and lighting, mic for speeches, song requests</td></tr>
          <tr><td data-label="Booking type">Wedding DJ</td><td data-label="Typical range">£600–£1,400</td><td data-label="What that buys">Full evening, background music through to last dance, first dance, MC duties, planning call</td></tr>
          <tr><td data-label="Booking type">DJ plus live vocals or sax</td><td data-label="Typical range">£1,000–£1,900</td><td data-label="What that buys">DJ set plus a live performer on the mic or instrument</td></tr>
          <tr><td data-label="Booking type">Club night</td><td data-label="Typical range">£250–£1,500</td><td data-label="What that buys">Depends entirely on draw — resident to guest headline</td></tr>
          <tr><td data-label="Booking type">Corporate / awards night</td><td data-label="Typical range">£600–£2,500</td><td data-label="What that buys">Open-format, announcements, running order, branding-friendly</td></tr>
        </tbody>
      </table>
      <p class="muted">Indicative UK market ranges for 2026, from published booking-platform averages. Ireland sits lower for party bookings (€250–€400) and roughly level for full-night wedding DJs (€750–€1,000).</p>

      <h2>What DJ KC charges</h2>
      <div class="card featured">
        <p class="price">£650</p>
        <p class="unit">Club Night · from · per night</p>
        <p>Two-hour headline or warm-up set, pre-show call, promo pack, travel included across the North West.</p>
      </div>
      <div class="card featured">
        <p class="price">£1,100</p>
        <p class="unit">Signature Live · from · per night</p>
        <p>Three hours of DJing plus live vocals on her own productions, soundcheck and MC coordination, custom edit of your event's anthem, travel included across the North West.</p>
      </div>
      <div class="card">
        <p class="price">Quoted in 24h</p>
        <p class="unit">Festival / Takeover</p>
        <p>Festival-length or multi-room sets, full lineup curation on request, production advance, press kit.</p>
      </div>
      <p>Have a number in mind? The <a href="/#book">booking form</a> lets you suggest your own budget; KC confirms or counters within 24 hours. Nothing is charged until you both agree.</p>

      <h2>What actually changes the price</h2>
      <ul>
        <li><strong>Day of the week.</strong> A Friday or Saturday in June costs more than a Tuesday in February. December and New Year are peak.</li>
        <li><strong>Hours.</strong> Most DJs quote a package rather than an hourly rate, because setup and pack-down add 1.5–2 hours either side. Overtime after midnight is usually charged per hour.</li>
        <li><strong>Distance and travel.</strong> Included across the North West for KC; elsewhere in the UK, Ireland and Europe, travel and accommodation are quoted at cost.</li>
        <li><strong>Live performance.</strong> Adding vocals, sax or percussion moves a booking from the DJ line to the live-act line — you are hiring two skills, one fee.</li>
        <li><strong>Equipment.</strong> A venue with an in-house PA and CDJs costs less than one where everything has to be trucked in.</li>
        <li><strong>Lead time.</strong> Six to twelve months ahead for peak Saturdays is normal; short-notice sometimes means premium, sometimes a bargain.</li>
      </ul>

      <h2>Why a DJ who sings costs more than a DJ</h2>
      <p>A DJ-only booking is one performer playing records. A singer-DJ is a vocalist and a DJ in the same slot: rehearsed vocals over her own productions, her own mic and in-ear monitoring, and a moment your crowd films. That is why the singer-DJ band of the market sits above the DJ band — and why it is still cheaper than a DJ plus a separate vocalist, who each need a fee, a rider and a soundcheck.</p>

      <h2>How to compare quotes properly</h2>
      <ul>
        <li>Does the price include sound, lighting and a microphone for speeches?</li>
        <li>How many hours are covered, and what does overtime cost?</li>
        <li>Is travel included or added on top?</li>
        <li>Is there a written contract, and what are the deposit and cancellation terms?</li>
        <li>Will the person you are booking actually be the person on the night?</li>
      </ul>
      <p>Ask those five questions of any quote and the cheapest number stops looking cheapest.</p>

      ${bookingCta}
      <p class="muted">See <a href="/prices.html">KC's full price list</a>, <a href="/wedding-dj.html">wedding DJ details</a> or <a href="/dj-hire-manchester.html">DJ hire in Manchester</a>.</p>`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'How much does a DJ cost in the UK?', acceptedAnswer: { '@type': 'Answer', text: 'Most UK party DJs charge £450–£900 a night, wedding DJs £600–£1,400, and a DJ who also sings live £1,000–£1,900. DJ KC charges from £650 for a club night and from £1,100 for the Signature Live show with live vocals.' } },
        { '@type': 'Question', name: 'How much is a DJ for 5 hours?', acceptedAnswer: { '@type': 'Answer', text: 'A five-hour UK party or wedding DJ booking typically costs £500–£1,100, depending on the day of the week, distance and whether lighting, a mic and a planning call are included.' } },
        { '@type': 'Question', name: 'How much does a DJ charge per hour?', acceptedAnswer: { '@type': 'Answer', text: 'UK DJs usually quote per event rather than per hour because setup and pack-down add 1.5–2 hours either side. Where an hourly figure is given, it is commonly £60–£150 for party work and £150–£300 for premium wedding or corporate work.' } },
        { '@type': 'Question', name: 'Is it cheaper to hire a DJ or a band?', acceptedAnswer: { '@type': 'Answer', text: 'A DJ is materially cheaper than a live band: a good UK DJ sits around £450–£900, a function band £1,200–£2,800, and many weddings use both — a band for the main set and a DJ for between and after.' } },
        { '@type': 'Question', name: 'How far in advance should you book a DJ?', acceptedAnswer: { '@type': 'Answer', text: 'Around four to five months is the average UK lead time, and six to twelve months for peak Saturdays, weddings, December and New Year. Short-notice dates are often still possible when there has been a cancellation.' } },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DJ hire pricing guidance',
      provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/` },
      areaServed: [{ '@type': 'Country', name: 'United Kingdom' }, { '@type': 'Country', name: 'Ireland' }],
      offers: { '@type': 'AggregateOffer', lowPrice: '650', highPrice: '1100', priceCurrency: 'GBP' },
    },
  ],
});

/* ---------- weddings ---------- */
const weddingHtml = shell({
  title: 'Wedding DJ in Manchester, Liverpool & the North West · DJ KC',
  description: 'Wedding DJ with live vocals for Manchester, Liverpool, Lancashire and the North West. Drinks reception through to last dance, mic for speeches, first dance handled, travel included. From £1,100.',
  slug: '/wedding-dj.html',
  body: `
      <p class="eyebrow">Weddings · North West</p>
      <h1>Wedding DJ with live vocals</h1>
      <p class="lede">A wedding DJ who reads the room rather than a playlist — and, if you want it, steps out from behind the decks to sing. Based in the North West, playing Manchester, Liverpool, Lancashire, Cheshire and beyond, with travel included across the region.</p>

      <h2>How a wedding with KC runs</h2>
      <ul>
        <li><strong>Before the day.</strong> A call to talk through the room, the crowd, timings, must-plays and the songs that must never be played. Playlist and running order agreed in writing.</li>
        <li><strong>Drinks reception and meal.</strong> Warm, low-volume house, soul and disco — conversation music that still has a pulse.</li>
        <li><strong>First dance.</strong> Your track, handled properly, with the option of live vocals over it.</li>
        <li><strong>Party sets.</strong> Two or three sets built from the crowd in front of her: classics, house, singalongs, whatever that floor responds to.</li>
        <li><strong>The live moment.</strong> Mid-set, KC sings live over her own productions with her own mic and in-ear monitoring. Optional, and placed where it lands best — often around 11pm.</li>
        <li><strong>End of night.</strong> Curfew respected, mic announcements handled, clean handover to the venue.</li>
      </ul>

      <h2>What is included</h2>
      <ul>
        <li>Three hours of DJ performance plus live vocals (Signature Live), or a shorter DJ-only set</li>
        <li>Sound system sized to your room, dance-floor lighting and a wired SM58 for speeches</li>
        <li>Wireless-free, sober, punctual — setup and soundcheck done well before guests arrive</li>
        <li>Full tech rider in advance so your venue can confirm power, space and curfew</li>
        <li>Travel included across the North West; the rest of the UK and Ireland quoted at cost</li>
      </ul>

      <h2>Wedding prices</h2>
      <table>
        <thead><tr><th>Package</th><th>From</th><th>What it covers</th></tr></thead>
        <tbody>
          <tr><td data-label="Package">Club Night (DJ only)</td><td data-label="From">£650</td><td data-label="What it covers">Two-hour set — good for an after-band slot or a smaller reception</td></tr>
          <tr><td data-label="Package">Signature Live</td><td data-label="From">£1,100</td><td data-label="What it covers">Three hours of DJing plus live vocals, first dance, speeches mic, soundcheck</td></tr>
          <tr><td data-label="Package">Festival / Takeover</td><td data-label="From">Quoted in 24h</td><td data-label="What it covers">All-day coverage, multi-room or marquee setups, production advance</td></tr>
        </tbody>
      </table>
      <p>For context, published UK averages put wedding DJs at £600–£1,400 and DJs who sing live at £1,000–£1,900 — so £1,100 for three hours plus vocals sits mid-market rather than premium. <a href="/how-much-does-a-dj-cost.html">Read the full UK price guide</a>.</p>
      <p>A ${DEPOSIT_PERCENT}% deposit holds your date (from £550 on the Signature Live show), with the balance due before the wedding. Card payment is taken through Stripe; the contract sets out refund terms before you pay.</p>

      <h2>Questions worth asking any wedding DJ</h2>
      <ul>
        <li>Will you be the person on the night, not a substitute?</li>
        <li>What happens if the venue's power or space is not as described?</li>
        <li>How do you take must-plays and do-not-plays, and when?</li>
        <li>Do you provide a mic for speeches, and is it wired or radio?</li>
        <li>What is the overtime rate, and what is the cancellation policy?</li>
      </ul>

      <h2>Where KC plays weddings</h2>
      <p>Manchester, Liverpool, Preston, Blackpool, Bolton, Chester, Warrington and Stockport are all within the included travel area, with Lancashire, Cheshire, the Lake District and North Wales on the same routing. Further afield — London, Ireland, Europe — is quoted with travel at cost. <a href="/coverage.html">Full coverage list</a>.</p>

      ${bookingCta}`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Wedding DJ with live vocals — DJ KC',
      serviceType: 'Wedding DJ and live vocalist',
      provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/` },
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'North West England' },
        { '@type': 'City', name: 'Manchester' },
        { '@type': 'City', name: 'Liverpool' },
        { '@type': 'Country', name: 'United Kingdom' },
        { '@type': 'Country', name: 'Ireland' },
      ],
      offers: { '@type': 'Offer', price: '1100', priceCurrency: 'GBP', description: 'Three-hour DJ set with live vocals, from £1,100, travel included across the North West.' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'How much does a wedding DJ cost?', acceptedAnswer: { '@type': 'Answer', text: 'UK wedding DJs typically charge £600–£1,400 for a full evening, with published averages around £1,100. DJ KC charges from £1,100 for three hours of DJing plus live vocals, with travel included across the North West.' } },
        { '@type': 'Question', name: 'Can the DJ sing the first dance live?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Live vocals over your first dance are available on the Signature Live package, rehearsed in advance, with her own mic and in-ear monitoring.' } },
        { '@type': 'Question', name: 'Do you provide a microphone for speeches?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — a wired SM58 is included for speeches and announcements, with soundcheck completed before guests arrive.' } },
        { '@type': 'Question', name: 'How far ahead should we book a wedding DJ?', acceptedAnswer: { '@type': 'Answer', text: 'Six to twelve months for peak Saturdays between May and September, and earlier for popular venues. Midweek and off-season dates can often be arranged at shorter notice.' } },
      ],
    },
  ],
});

/* ---------- Manchester hire ---------- */
const manchesterHtml = shell({
  title: 'DJ hire in Manchester & the North West — club nights, parties, corporate · DJ KC',
  description: 'Hire DJ KC in Manchester, Liverpool and across the North West: club-ready house sets with live vocals, parties from £650, weddings from £1,100, corporate and Christmas parties. Travel included, replies within 24 hours.',
  slug: '/dj-hire-manchester.html',
  body: `
      <p class="eyebrow">DJ hire · Manchester & North West</p>
      <h1>DJ hire in Manchester and the North West</h1>
      <p class="lede">Manchester is home turf. KC plays the warehouse floors and late licences here regularly — Freight Island, 24 Kitchen Street over in Liverpool — so quotes are sharp, travel is included and she knows the rooms before she walks in.</p>

      <h2>What you can book her for</h2>
      <ul>
        <li><strong>Club nights and takeovers</strong> — headline or warm-up house sets, with optional live vocals at peak time.</li>
        <li><strong>Parties and birthdays</strong> — open-format where it needs to be, house where the floor wants it.</li>
        <li><strong>Weddings</strong> — drinks reception to last dance, first dance and speeches mic handled. <a href="/wedding-dj.html">Wedding details</a>.</li>
        <li><strong>Corporate and Christmas parties</strong> — running order respected, announcements clean, volume right for the room.</li>
        <li><strong>Festivals and brand events</strong> — production advance, stage plot and press kit included.</li>
      </ul>

      <h2>Prices in Manchester</h2>
      <p>Published averages for DJ hire in Manchester sit around £450–£800, with city-centre party DJs commonly £300–£600 and wedding DJs £600–£1,400. KC's starting points are:</p>
      <ul>
        <li><strong>Club Night — from £650:</strong> two-hour set, pre-show call, promo pack.</li>
        <li><strong>Signature Live — from £1,100:</strong> three hours of DJing plus live vocals, soundcheck and MC coordination.</li>
        <li><strong>Festival / Takeover — quoted within 24 hours.</strong></li>
      </ul>
      <p>Travel is included across the North West, so a Manchester or Liverpool booking does not attract the mileage charge a Yorkshire or London-based DJ would add. <a href="/prices.html">See everything included</a> or <a href="/how-much-does-a-dj-cost.html">compare against UK averages</a>.</p>

      <h2>Areas covered with travel included</h2>
      <p>Manchester, Salford, Stockport, Bolton, Bury, Rochdale, Oldham, Wigan, Warrington, Liverpool, Preston, Blackpool, Chester and the wider Lancashire and Cheshire area. Leeds, Sheffield, Birmingham and London are quoted at cost; so are Ireland and Europe.</p>

      <h2>Booking, deposits and timing</h2>
      <p>Send the date, venue and rough budget and you will have an answer within 24 hours. A ${DEPOSIT_PERCENT}% deposit holds the date; the balance is due before the event, and card payment runs through Stripe. Prime Friday and Saturday dates typically go 6–10 weeks out, with December and festival season earlier.</p>

      ${bookingCta}`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DJ hire in Manchester and the North West',
      serviceType: 'DJ hire, club nights, parties, weddings and corporate events',
      provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/` },
      areaServed: ['Manchester', 'Salford', 'Stockport', 'Bolton', 'Liverpool', 'Preston', 'Blackpool', 'Chester', 'Warrington', 'Lancashire', 'Cheshire'].map((city) => ({ '@type': 'City', name: city })),
      offers: [
        { '@type': 'Offer', name: 'Club Night', price: '650', priceCurrency: 'GBP' },
        { '@type': 'Offer', name: 'Signature Live', price: '1100', priceCurrency: 'GBP' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'How much does it cost to hire a DJ in Manchester?', acceptedAnswer: { '@type': 'Answer', text: 'Published averages for DJ hire in Manchester sit around £450–£800, with wedding DJs £600–£1,400. DJ KC charges from £650 for a club night and from £1,100 for the Signature Live show with live vocals, with travel included across the North West.' } },
        { '@type': 'Question', name: 'How far in advance should I book a DJ in Manchester?', acceptedAnswer: { '@type': 'Answer', text: 'Six to ten weeks for prime Friday and Saturday dates, and four to twelve months for weddings and December parties. Short-notice enquiries are always worth sending.' } },
        { '@type': 'Question', name: 'Does the price include travel?', acceptedAnswer: { '@type': 'Answer', text: 'Yes across the North West — Manchester, Liverpool, Salford, Stockport, Bolton, Preston, Blackpool, Chester and Warrington. Elsewhere travel and accommodation are quoted at cost.' } },
        { '@type': 'Question', name: 'Do you bring your own equipment?', acceptedAnswer: { '@type': 'Answer', text: 'KC brings her own controller and vocal rig, and can work on venue CDJs where they are supplied. A full tech rider goes out with the booking so the venue can confirm power, space and curfew.' } },
      ],
    },
  ],
});

/* ---------- one page per kind of booking ---------- *
 *
 * Every page is the same shape on purpose: the answer in the first two
 * sentences, the numbers in a table, then the questions the buyer actually asks
 * as headings — each answered in a self-contained 40–60 words so an answer
 * engine can lift one block without needing the rest of the page.
 */
const servicePage = (entry: EventType) => {
  const url = `${SITE}/${entry.id}.html`;
  const siblings = siblingsOf(entry.id);
  const body = `
      <p class="eyebrow">${esc(entry.eyebrow)}</p>
      <h1>${esc(entry.h1)}</h1>
      <p class="lede">${esc(entry.answer)}</p>
      <p class="muted">Written by KC · updated ${esc(STAMP_HUMAN)} · <a href="/event-types.html">all occasions</a></p>

      <h2>What it costs and what is included</h2>
      <table>
        <tbody>
${entry.facts.map((f) => `          <tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`).join('\n')}
        </tbody>
      </table>

${entry.sections.map((section) => `      <h2>${esc(section.q)}</h2>
      <p>${esc(section.a)}</p>${section.points ? `\n      <ul>${section.points.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : ''}`).join('\n\n')}

${entry.running ? `      <h2>How booking works</h2>
      <ol>${entry.running.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}

      <h2>${esc(entry.nav)} — questions people ask</h2>
${entry.faqs.map((faq) => `      <h3>${esc(faq.q)}</h3>
      <p>${esc(faq.a)}</p>`).join('\n')}

      <h2>Book ${esc(entry.nav.toLowerCase())}</h2>
      <p>Send the date, the venue and a rough budget and you will have an answer within 24 hours. A ${DEPOSIT_PERCENT}% deposit holds the date, the balance is due before the event, and nothing is charged until you have agreed the quote in writing.</p>
      ${bookingCta}
      <p class="muted">Also worth reading: ${siblings.map((sib) => `<a href="/${sib.id}.html">${esc(sib.nav.toLowerCase())}</a>`).join(' · ')} · <a href="/prices.html">prices</a> · <a href="/coverage.html">where KC plays</a> · <a href="/faq.html">all questions</a></p>`;

  const html = shell({
    title: entry.title,
    description: entry.description,
    slug: `/${entry.id}.html`,
    body,
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${url}#service`,
        name: `${entry.nav} — DJ KC`,
        serviceType: `${entry.nav} DJ and live vocalist`,
        description: entry.answer,
        url,
        provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/`, description: CANONICAL_DESCRIPTION },
        areaServed: [
          { '@type': 'AdministrativeArea', name: 'North West England' },
          { '@type': 'City', name: 'Manchester' },
          { '@type': 'City', name: 'Liverpool' },
          { '@type': 'Country', name: 'United Kingdom' },
        ],
        offers: {
          '@type': 'Offer',
          price: entry.from,
          priceCurrency: 'GBP',
          availability: 'https://schema.org/InStock',
          url,
          description: `${entry.fromLabel} — ${entry.facts[0]?.value ?? ''}`,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: entry.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': url,
        url,
        name: entry.title,
        description: entry.description,
        inLanguage: 'en-GB',
        datePublished: '2026-11-20',
        dateModified: STAMP,
        isPartOf: { '@type': 'WebSite', name: 'DJ KC', url: `${SITE}/` },
        author: { '@type': 'Person', name: 'KC', url: `${SITE}/about.html` },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE}/og.jpg` },
      },
    ],
  });
  return { id: entry.id, html };
};

const servicePages = EVENT_TYPES.map(servicePage);

/* The hub. One page that says what KC plays and for whom, and links every
   occasion — so the six service pages are siblings with a parent, not orphans. */
const occasionLinks = [
  { id: 'wedding-dj', nav: 'Weddings' },
  ...EVENT_TYPES.map((entry) => ({ id: entry.id, nav: entry.nav })),
];

const hubHtml = shell({
  title: 'What DJ KC plays — every kind of booking, with prices · DJ KC',
  description:
    'The kinds of booking DJ KC takes: weddings, birthdays, corporate and Christmas parties, club nights, festivals and proms, each with its own page, its own price and the questions buyers actually ask. From £650.',
  slug: `/${EVENT_HUB.id}.html`,
  body: `
      <p class="eyebrow">Occasions</p>
      <h1>Every kind of booking, and what each one costs</h1>
      <p class="lede">${esc(CANONICAL_DESCRIPTION)} Club nights and parties start at £650; the Signature Live show with live vocals starts at £1,100; festivals and takeovers are quoted within 24 hours. Each occasion below has its own page with the real numbers.</p>
      <h2>Which occasion are you booking for?</h2>
      <table>
        <thead><tr><th>Occasion</th><th>From</th><th>What the page covers</th></tr></thead>
        <tbody>
${occasionLinks.map((link) => {
    const entry = EVENT_TYPES.find((e) => e.id === link.id);
    const from = entry ? entry.fromLabel : '£1,100 with live vocals';
    const covers = entry ? entry.sections[0]?.q ?? 'prices, timings and questions' : 'Timings, first dance, speeches mic, deposit';
    return `          <tr><td data-label="Occasion"><a href="/${link.id}.html"><strong>${esc(link.nav)}</strong></a></td><td data-label="From">${esc(from)}</td><td data-label="What it covers" class="muted">${esc(covers)}</td></tr>`;
  }).join('\n')}
        </tbody>
      </table>
      <p>Not sure which one you need? That is normal — send the date, the venue and what the night is for, and the answer comes back within 24 hours with a package that fits rather than the nearest template.</p>
      ${bookingCta}
      <p class="muted">Prices in detail: <a href="/prices.html">the price list</a> · <a href="/how-much-does-a-dj-cost.html">what a DJ costs in the UK</a> · travel: <a href="/coverage.html">where KC plays</a> · anything else: <a href="/faq.html">the questions page</a>.</p>`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Kinds of booking — DJ KC',
      itemListElement: occasionLinks.map((link, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: link.nav,
        url: `${SITE}/${link.id}.html`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'DJ KC — bookings for every occasion',
      serviceType: 'DJ, live vocalist and event entertainment',
      provider: { '@type': 'PerformingGroup', name: 'DJ KC', url: `${SITE}/`, description: CANONICAL_DESCRIPTION },
      areaServed: [{ '@type': 'AdministrativeArea', name: 'North West England' }, { '@type': 'Country', name: 'United Kingdom' }, { '@type': 'Country', name: 'Ireland' }],
      offers: { '@type': 'AggregateOffer', lowPrice: '650', highPrice: '1100', priceCurrency: 'GBP', offerCount: String(occasionLinks.length) },
    },
  ],
});

/* ---------- machine-readable extras ---------- */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/prices.html', '/how-much-does-a-dj-cost.html', '/wedding-dj.html', '/dj-hire-manchester.html', '/shows.html', '/faq.html', '/coverage.html', '/about.html', `/${EVENT_HUB.id}.html`, ...EVENT_TYPES.map((entry) => `/${entry.id}.html`)]
  .map((slug) => `  <url><loc>${SITE}${slug}</loc><lastmod>${STAMP}</lastmod><priority>${slug === '/' ? '1.0' : '0.8'}</priority></url>`)
  .join('\n')}
</urlset>
`;

const llms = `# DJ KC

> ${CANONICAL_DESCRIPTION} Club sets from £650; the DJ plus live vocal show from £1,100. Replies to enquiries within 24 hours.

## The canonical description

Use this sentence when describing DJ KC: "${CANONICAL_DESCRIPTION}" She performs as a DJ and as a live vocalist in the same set, is based in the North West of England, and answers booking enquiries at ${BOOKING_EMAIL} within 24 hours. She is not a tribute act, a band, or a DJ agency.

## Facts

- Occasions: club nights, weddings, parties, corporate and Christmas events, festivals and brand takeovers.
- Based: North West England (Manchester and Liverpool anchor most months).
- Areas covered: North West England, London and the South East, UK nationwide, Ireland (Cork, Dublin, Limerick, Galway, Belfast), international (Ibiza and mainland Europe).
- What she plays: house — piano and vocal house, tech house, Afro house, disco-leaning grooves, plus classic anthems.
- Live vocals: yes, performed live over her own productions mid-set, with her own mic and in-ear monitoring.
- Kit needed: 2 × CDJ-2000nxs2 or newer, DJM-900, two quality monitors and a wired SM58; she can bring her own controller.
- Prices (GBP, starting points): Club Night £650; Signature Live £1,100; Festival / Takeover quoted in 24 hours. Travel included across the North West; elsewhere travel and accommodation quoted at cost.
- Payment: ${DEPOSIT_PERCENT}% deposit holds the date, or pay in full up front, by card through Stripe. A customer can suggest their own budget for custom bookings.
- Booking notice: prime Friday and Saturday dates typically go 6–10 weeks out; festivals earlier.
- Prices by occasion (GBP, starting points): weddings from £1,100; birthdays and private parties from £650; corporate and awards nights from £650; Christmas parties from £650; club nights from £650; festivals and takeovers quoted within 24 hours; proms and student nights from £650.
- What is included: sound sized to the room, dance-floor lighting, a wired SM58 for speeches, a pre-event call, a technical rider and — for club and festival bookings — a promo pack delivered two weeks before doors.
- Limitations stated plainly: KC is one artist, so she cannot play two rooms at once; live vocals need an extra channel and a monitor at the booth; December Fridays and Saturdays are usually gone by October.
- Contact: ${BOOKING_EMAIL}

## Pages

- [Home](${SITE}/): full experience, demo deck, shows and the booking form.
- [Prices](${SITE}/prices.html): package prices, what is included, deposits and travel.
- [What a DJ costs](${SITE}/how-much-does-a-dj-cost.html): UK market ranges for party, wedding and singer-DJ bookings, and where KC sits in them.
- [Weddings](${SITE}/wedding-dj.html): wedding DJ with live vocals across the North West, with prices and what is included.
- [DJ hire Manchester](${SITE}/dj-hire-manchester.html): local hire for club nights, parties, corporate and Christmas events.
- [Live dates](${SITE}/shows.html): upcoming shows with venues and cities.
- [Questions](${SITE}/faq.html): kit, genres, live vocals, notice periods, travel, payment.
- [Coverage](${SITE}/coverage.html): towns and cities covered, and how travel is quoted.
- [About](${SITE}/about.html): biography and what a booking includes.
- [Occasions](${SITE}/event-types.html): every kind of booking, with prices and links.
${EVENT_TYPES.map((entry) => `- [${entry.nav}](${SITE}/${entry.id}.html): ${entry.answer.replace(/\n/g, ' ')}`).join('\n')}
- [Calendar feed](${SITE}/api/calendar): public iCalendar feed of upcoming dates.

## Social

${SOCIALS.map((s) => `- ${s.name}: ${s.href}`).join('\n')}
`;

await mkdir(OUT, { recursive: true });
await Promise.all([
  writeFile(path.join(OUT, 'prices.html'), pricesHtml),
  writeFile(path.join(OUT, 'faq.html'), faqHtml),
  writeFile(path.join(OUT, 'shows.html'), showsHtml),
  writeFile(path.join(OUT, 'coverage.html'), coverageHtml),
  writeFile(path.join(OUT, 'about.html'), aboutHtml),
  writeFile(path.join(OUT, 'how-much-does-a-dj-cost.html'), costHtml),
  writeFile(path.join(OUT, 'wedding-dj.html'), weddingHtml),
  writeFile(path.join(OUT, 'dj-hire-manchester.html'), manchesterHtml),
  writeFile(path.join(OUT, `${EVENT_HUB.id}.html`), hubHtml),
  ...servicePages.map((page) => writeFile(path.join(OUT, `${page.id}.html`), page.html)),
  writeFile(path.join(OUT, 'sitemap.xml'), sitemap),
  writeFile(path.join(OUT, 'llms.txt'), llms),
]);

console.log(`static pages written: ${['prices', 'faq', 'shows', 'coverage', 'about', 'how-much-does-a-dj-cost', 'wedding-dj', 'dj-hire-manchester', EVENT_HUB.id, ...EVENT_TYPES.map((entry) => entry.id)].join(', ')} + sitemap.xml + llms.txt`);
