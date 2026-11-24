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
