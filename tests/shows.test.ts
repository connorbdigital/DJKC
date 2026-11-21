import { expect, it } from 'vitest';
import { SHOWS } from '../src/data';
import { calendarEvent, partitionShows } from '../src/utils/shows';
import { calendarDate } from '../src/utils/dates';

it('uses the venue calendar day even when the UTC date differs', () => {
  expect(calendarDate(new Date('2026-07-01T23:30:00Z'), 'Europe/Dublin')).toBe('2026-07-02');
  const { upcoming, past } = partitionShows(SHOWS, new Date('2026-11-21T21:00:00Z'));
  expect(upcoming.map(s => s.venue)).toEqual(['Edison', 'Freight Island', '24 Kitchen Street', 'Egg', 'Pikes']);
  expect(past).toHaveLength(2);
  expect(partitionShows(SHOWS, new Date('2027-02-20T23:15:00Z')).upcoming).toHaveLength(0); // already the 21st in Ibiza
});
it('exports a known local start as an instant and unknown times as date-only', () => {
  expect(calendarEvent(SHOWS[2])).toContain('DTSTART:20261121T200000Z');
  expect(calendarEvent(SHOWS[0])).toContain('DTSTART;VALUE=DATE:20260227');
  expect(calendarEvent(SHOWS[2])).toContain('LOCATION:Edison\\, Cork\\, IE');
  expect(calendarEvent(SHOWS[0])).not.toContain('8pm');
});
