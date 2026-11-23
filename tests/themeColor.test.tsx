// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  SECTION_THEMES,
  canAnimateTab,
  faviconFor,
  mixHex,
  tabAccentAt,
  themeFor,
  useThemeColor,
} from '../src/utils/themeColor';

function Probe() { useThemeColor(); return null; }
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

it('maps every section to a distinct toolbar colour and a brand favicon', () => {
  expect(new Set(SECTION_THEMES.map(t => t.bar)).size).toBe(SECTION_THEMES.length);
  expect(themeFor('pricing').accent).toBe('#ffb224');
  expect(themeFor('missing').bar).toBe('#0a0512');
  expect(faviconFor('#2bd9ff')).toContain('%232bd9ff');
  expect(faviconFor('#2bd9ff')).not.toContain('#2bd9ff');
});

it('recolours the browser bar as sections scroll into view', async () => {
  document.head.innerHTML = '<meta name="theme-color" content="#0a0512"><link rel="icon" href="start">';
  Object.entries({ top: 0, why: 800, music: 1600, shows: 2400, voices: 3200, pricing: 4000, faq: 4800, book: 5600 })
    .forEach(([id, top]) => {
      const el = document.createElement('section');
      el.id = id;
      el.getBoundingClientRect = () => ({ top: top - window.scrollY, height: 800 }) as DOMRect;
      document.body.append(el);
    });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

  render(<Probe />);
  const meta = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');
  const icon = () => document.querySelector('link[rel="icon"]')!.getAttribute('href');
  expect(meta()).toBe(SECTION_THEMES[0].bar);
  expect(icon()).toBe(faviconFor(SECTION_THEMES[0].accent));

  (window as unknown as { scrollY: number }).scrollY = 1700;
  window.dispatchEvent(new Event('scroll'));
  await new Promise(r => setTimeout(r, 40));
  expect(meta()).toBe(themeFor('music').bar);
  expect(icon()).toBe(faviconFor(themeFor('music').accent));
});

it('blends smoothly around the brand stops for the animated icon', () => {
  expect(tabAccentAt(0)).toBe('#ff2bd6');
  expect(tabAccentAt(0.2)).toBe('#8b5cf6');
  expect(tabAccentAt(0.4)).toBe('#2bd9ff');
  expect(tabAccentAt(1)).toBe('#ff2bd6');
  expect(tabAccentAt(0.21)).not.toBe(tabAccentAt(0.2));
  expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  expect(mixHex('#ff0000', '#00ff00', 2)).toBe('#00ff00');
});

it('only animates on a fine pointer without a reduced-motion preference', () => {
  const media = (hover: boolean, reduce: boolean) =>
    ({ matchMedia: (q: string) => ({ matches: q.includes('reduce') ? reduce : hover }) }) as unknown as Window;
  expect(canAnimateTab(media(true, false))).toBe(true);
  expect(canAnimateTab(media(true, true))).toBe(false);
  expect(canAnimateTab(media(false, false))).toBe(false);
});

it('animates the desktop tab icon over time', async () => {
  vi.useFakeTimers();
  document.head.innerHTML = '<meta name="theme-color" content="#0a0512"><link rel="icon" href="start">';
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('hover') }));
  render(<Probe />);
  const icon = () => document.querySelector('link[rel="icon"]')!.getAttribute('href');
  const first = icon();
  expect(first).not.toBe('start');
  await vi.advanceTimersByTimeAsync(400);
  const later = icon();
  expect(later).not.toBe(first);
  await vi.advanceTimersByTimeAsync(3000);
  expect(icon()).not.toBe(later);
});
