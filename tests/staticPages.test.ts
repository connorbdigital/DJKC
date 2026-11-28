import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

it('ships a no-indexed share preview that mirrors the live tags', () => {
  expect(existsSync('public/share-preview.html')).toBe(true);
  const page = read('public/share-preview.html');
  expect(page).toContain('noindex');
  expect(page).toContain('src="og.jpg"');
  expect(page).toContain('North West, UK');
  expect(page).toContain('Bookings from £650');
  const index = read('index.html');
  expect(index).toContain('content="https://kaysie.sitebuildup.co.uk/og.jpg"');
});

it('ships a token-gated booking admin with no public data in the HTML', () => {
  expect(existsSync('public/admin.html')).toBe(true);
  const page = read('public/admin.html');
  expect(page).toContain('noindex');
  expect(page).toContain('type="password"');
  expect(page).toContain('/api/bookings?format=json');
  expect(page).toContain('/api/bookings",');
  expect(page).toContain('method: "PATCH"');
  expect(page).toContain('/api/subscribers?format=json');
  expect(page).toContain('sessionStorage');
  expect(page).not.toContain('localStorage');
  expect(page).toContain('nothing is emailed automatically');
});

it('keeps the internal pages out of search results', () => {
  const robots = read('public/robots.txt');
  expect(robots).toContain('Disallow: /admin.html');
  expect(robots).toContain('Disallow: /share-preview.html');
});

it('opens the site to search and answer engines and points them at a sitemap', () => {
  const robots = read('public/robots.txt');
  expect(robots).toContain('Sitemap: https://kaysie.sitebuildup.co.uk/sitemap.xml');
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']) {
    expect(robots).toContain(`User-agent: ${bot}`);
  }
  expect(robots).toContain('Disallow: /admin.html');
});

it('publishes facts without JavaScript and describes the act, not just a person', () => {
  const index = read('index.html');
  expect(index).toContain('<noscript>');
  expect(index).toContain('Club sets from £650');
  expect(index).toContain('href="/prices.html"');
  expect(index).toContain('"@type": "PerformingGroup"');
  expect(index).toContain('"priceCurrency": "GBP"');
  expect(index).toContain('booking@djkcmusic.com');
});

it('generates crawlable pages and machine-readable summaries after a build', () => {
  const pkg = JSON.parse(read('package.json'));
  expect(pkg.scripts.postbuild).toContain('scripts/build-static-pages.mts');
  const script = read('scripts/build-static-pages.mts');
  for (const page of ['prices', 'faq', 'shows', 'coverage', 'about', 'how-much-does-a-dj-cost', 'wedding-dj', 'dj-hire-manchester']) {
    expect(script).toContain(`${page}.html`);
  }
  expect(script).toContain('sitemap.xml');
  expect(script).toContain('llms.txt');
  expect(script).toContain('FAQPage');
  expect(script).toContain('OfferCatalog');
  expect(script).toContain('MusicEvent');
  expect(script).toContain('how-much-does-a-dj-cost.html');
  expect(script).toContain('wedding-dj.html');
  expect(script).toContain('dj-hire-manchester.html');
});

it('targets the phrases buyers actually search for', () => {
  const index = read('index.html');
  expect(index).toContain('DJ Hire Manchester');
  expect(index).toContain('Hire DJ KC');
  expect(index).toContain('weddings and parties');

  const data = read('src/data.ts');
  for (const question of [
    'How much does a DJ cost in the UK?',
    'Do you play weddings?',
    'Can you play a corporate party or Christmas do?',
    "What's the difference between a DJ and a singer-DJ?",
  ]) {
    expect(data).toContain(question);
  }

  const footer = read('src/components/Footer.tsx');
  expect(footer).toContain('/how-much-does-a-dj-cost.html');
  expect(footer).toContain('/wedding-dj.html');
  expect(footer).toContain('/dj-hire-manchester.html');
});

it('says who is taking the money and what happens to it, before anyone pays', () => {
  const script = read('scripts/build-static-pages.mts');
  const trading = read('src/trading.ts');

  /* The three pages the audit said were missing: how a booking works, the
     booking terms, and a privacy notice. All three are generated, so they exist
     without JavaScript and carry the trader identity from one module. */
  for (const page of ['book.html', 'terms.html', 'privacy.html']) {
    expect(script).toContain(page);
  }
  expect(script).toContain('ContactPage');
  expect(script).toContain('tradingLines()');
  expect(script).toContain('ENQUIRY_RETENTION_MONTHS');
  expect(script).toContain('BOOKING_RETENTION_YEARS');

  expect(trading).toContain('export const TRADING');
  expect(trading).toContain('BOOKING_EMAIL');
  expect(read('src/data.ts')).toContain('booking@djkcmusic.com');
  expect(trading).not.toMatch(/address: "[^"]/);
  expect(trading).toContain('Postal address: ask by email');

  /* Linked from the sitewide footer, not only the sitemap. */
  const footer = read('src/components/Footer.tsx');
  for (const href of ['/book.html', '/terms.html', '/privacy.html']) {
    expect(footer).toContain(href);
  }

  /* And reachable from the crawlable pages themselves. */
  expect(script).toContain('<a href="/terms.html">Booking terms</a>');
  expect(script).toContain('<a href="/privacy.html">Privacy</a>');
});

it('keeps one answer per booking question', () => {
  const data = read('src/data.ts');
  const asked = data.match(/How far in advance should we book\?/g) ?? [];
  expect(asked).toHaveLength(1);
});
