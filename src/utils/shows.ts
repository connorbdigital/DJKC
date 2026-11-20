import type { Show } from '../data';
import { calendarDate } from './dates';

export function partitionShows(shows: Show[], now = new Date()) {
  const today = calendarDate(now, 'Europe/Dublin').replace(/-/g, '');
  const ordered = [...shows].sort((a, b) => a.iso.localeCompare(b.iso));
  return { upcoming: ordered.filter(s => s.iso >= today), past: ordered.filter(s => s.iso < today).reverse() };
}

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&');
const timestamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

export function calendarEvent(s: Show, now = new Date()) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DJ KC//Live Dates//EN', 'BEGIN:VEVENT',
    `UID:${s.iso}-${encodeURIComponent(s.venue)}@djkcmusic.com`, `DTSTAMP:${timestamp(now)}`,
    s.startsAt ? `DTSTART:${timestamp(new Date(s.startsAt))}` : `DTSTART;VALUE=DATE:${s.iso}`,
    `SUMMARY:${escapeText(`DJ KC — ${s.event}`)}`, `LOCATION:${escapeText(`${s.venue}, ${s.city}`)}`,
    `DESCRIPTION:${escapeText(s.note)}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
