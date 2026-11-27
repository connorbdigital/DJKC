import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CANONICAL_DESCRIPTION, EVENT_TYPES, siblingsOf } from '../src/eventTypes';

const read = (file: string) => readFileSync(file, 'utf8');
const words = (text: string) => text.trim().split(/\s+/).length;

/**
 * These pages exist to be quoted, so the shape matters more than the prose:
 * an answer that stands alone, numbers that can be checked, and questions a
 * buyer would actually type as the headings.
 */
describe('the occasions pages', () => {
  it('covers every kind of booking once, with a stable url each', () => {
    const ids = EVENT_TYPES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(ids).toContain('birthday-party-dj');
    expect(ids).toContain('corporate-dj');
    expect(ids).toContain('christmas-party-dj');
    expect(ids).toContain('club-night-dj');
    expect(ids).toContain('festival-dj');
    expect(ids).toContain('prom-dj');
  });

  it('leads with an answer an engine can lift on its own', () => {
    for (const entry of EVENT_TYPES) {
      /* 40–60 words is the band that survives extraction intact; too short and
         it lacks a fact, too long and the quote gets cut mid-sentence. */
      expect(words(entry.answer), entry.id).toBeGreaterThanOrEqual(35);
      expect(words(entry.answer), entry.id).toBeLessThanOrEqual(75);
      expect(entry.answer.endsWith('.'), entry.id).toBe(true);
      expect(entry.answer, entry.id).toContain('KC');
    }
  });

  it('gives every page its own title, description and price', () => {
    const titles = new Set(EVENT_TYPES.map((entry) => entry.title));
    expect(titles.size).toBe(EVENT_TYPES.length);
    for (const entry of EVENT_TYPES) {
      expect(entry.title.length).toBeGreaterThan(30);
      expect(entry.title.length).toBeLessThanOrEqual(75);
      expect(entry.description.length).toBeGreaterThanOrEqual(110);
      expect(entry.description.length).toBeLessThanOrEqual(185);
      expect(entry.facts.length).toBeGreaterThanOrEqual(4);
      expect(entry.from).toMatch(/^\d+$/);
    }
  });

  it('asks the questions buyers ask, each answered in a quotable chunk', () => {
    for (const entry of EVENT_TYPES) {
      expect(entry.sections.length, entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.faqs.length, entry.id).toBeGreaterThanOrEqual(3);
      for (const section of entry.sections) {
        expect(section.q.endsWith('?'), `${entry.id}: ${section.q}`).toBe(true);
        expect(words(section.a), `${entry.id}: ${section.q}`).toBeGreaterThanOrEqual(20);
      }
      for (const faq of entry.faqs) {
        expect(faq.q.endsWith('?'), `${entry.id}: ${faq.q}`).toBe(true);
        expect(words(faq.a), `${entry.id}: ${faq.q}`).toBeGreaterThanOrEqual(25);
      }
    }
  });

  it('links each page to siblings so the hub is not the only route in', () => {
    for (const entry of EVENT_TYPES) {
      const siblings = siblingsOf(entry.id);
      expect(siblings.length).toBe(2);
      expect(siblings.map((sib) => sib.id)).not.toContain(entry.id);
    }
  });

  it('describes the act in one sentence, everywhere', () => {
    expect(CANONICAL_DESCRIPTION).toContain('DJ KC');
    expect(CANONICAL_DESCRIPTION).toContain('North West of England');
    const script = read('scripts/build-static-pages.mts');
    expect(script).toContain('CANONICAL_DESCRIPTION');
  });
});

describe('built occasions pages', () => {
  const built = existsSync('dist/event-types.html');

  it.runIf(built)('writes the hub and one page per occasion', () => {
    for (const entry of EVENT_TYPES) {
      expect(existsSync(`dist/${entry.id}.html`), entry.id).toBe(true);
    }
    const hub = read('dist/event-types.html');
    for (const entry of EVENT_TYPES) expect(hub).toContain(`/${entry.id}.html`);
    expect(hub).toContain('/wedding-dj.html');
  });

  it.runIf(built)('carries service, faq and page schema with real dates', () => {
    for (const entry of EVENT_TYPES) {
      const html = read(`dist/${entry.id}.html`);
      expect(html).toContain('"@type":"Service"');
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).toContain('"@type":"WebPage"');
      expect(html).toContain('"dateModified"');
      expect(html).toContain(`"price":"${entry.from}"`);
      expect(html).toContain('rel="canonical"');
    }
  });

  it.runIf(built)('is in the sitemap and in llms.txt', () => {
    const sitemap = read('dist/sitemap.xml');
    const llms = read('dist/llms.txt');
    for (const entry of EVENT_TYPES) {
      expect(sitemap).toContain(`/${entry.id}.html`);
      expect(llms).toContain(`/${entry.id}.html`);
    }
    expect(sitemap).toContain('/event-types.html');
  });
});
