// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SECTION_THEMES, faviconFor, themeFor, useThemeColor } from '../src/utils/themeColor';

function Probe() { useThemeColor(); return null; }
afterEach(() => { cleanup(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

it('maps every section to a distinct toolbar colour and a brand favicon', () => {
  expect(new Set(SECTION_THEMES.map(t => t.bar)).size).toBe(SECTION_THEMES.length);
  expect(themeFor('pricing').accent).toBe('#ffb224');
  expect(themeFor('missing').bar).toBe('#0a0512');
  expect(faviconFor('#2bd9ff')).toContain('%232bd9ff');
  expect(faviconFor('#2bd9ff')).not.toContain('#2bd9ff');
});

it('recolours the browser bar and tab icon as sections scroll into view', async () => {
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
