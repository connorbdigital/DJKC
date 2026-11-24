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

const esc = (value: string) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const json = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

const PAGES = [
  { href: '/prices.html', label: 'Prices' },
  { href: '/shows.html', label: 'Live dates' },
  { href: '/faq.html', label: 'Questions' },
  { href: '/coverage.html', label: 'Where KC plays' },
  { href: '/about.html', label: 'About KC' },
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
            <td>${esc(`${s.day} ${s.date}`)}${s.area ? `<div class="muted">${esc(s.area)}</div>` : ''}</td>
            <td><strong>${esc(s.venue)}</strong><div class="muted">${esc(s.city)}</div></td>
            <td>${esc(s.event)}</td>
            <td class="muted">${esc(s.note)}</td>
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

/* ---------- machine-readable extras ---------- */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/prices.html', '/shows.html', '/faq.html', '/coverage.html', '/about.html']
  .map((slug) => `  <url><loc>${SITE}${slug}</loc><lastmod>${STAMP}</lastmod><priority>${slug === '/' ? '1.0' : '0.8'}</priority></url>`)
  .join('\n')}
</urlset>
`;

const llms = `# DJ KC

> House DJ, live vocalist and producer based in the North West of England. Available for club nights, festivals, weddings and private events across the UK, Ireland and internationally. Club sets from £650; the DJ plus live vocal show from £1,100. Replies to enquiries within 24 hours.

## Facts

- Based: North West England (Manchester and Liverpool anchor most months).
- Areas covered: North West England, London and the South East, UK nationwide, Ireland (Cork, Dublin, Limerick, Galway, Belfast), international (Ibiza and mainland Europe).
- What she plays: house — piano and vocal house, tech house, Afro house, disco-leaning grooves, plus classic anthems.
- Live vocals: yes, performed live over her own productions mid-set, with her own mic and in-ear monitoring.
- Kit needed: 2 × CDJ-2000nxs2 or newer, DJM-900, two quality monitors and a wired SM58; she can bring her own controller.
- Prices (GBP, starting points): Club Night £650; Signature Live £1,100; Festival / Takeover quoted in 24 hours. Travel included across the North West; elsewhere travel and accommodation quoted at cost.
- Payment: ${DEPOSIT_PERCENT}% deposit holds the date, or pay in full up front, by card through Stripe. A customer can suggest their own budget for custom bookings.
- Booking notice: prime Friday and Saturday dates typically go 6–10 weeks out; festivals earlier.
- Contact: ${BOOKING_EMAIL}

## Pages

- [Home](${SITE}/): full experience, demo deck, shows and the booking form.
- [Prices](${SITE}/prices.html): package prices, what is included, deposits and travel.
- [Live dates](${SITE}/shows.html): upcoming shows with venues and cities.
- [Questions](${SITE}/faq.html): kit, genres, live vocals, notice periods, travel, payment.
- [Coverage](${SITE}/coverage.html): towns and cities covered, and how travel is quoted.
- [About](${SITE}/about.html): biography and what a booking includes.
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
  writeFile(path.join(OUT, 'sitemap.xml'), sitemap),
  writeFile(path.join(OUT, 'llms.txt'), llms),
]);

console.log(`static pages written: ${['prices', 'faq', 'shows', 'coverage', 'about'].join(', ')} + sitemap.xml + llms.txt`);
