import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHOWS } from '../src/data.js';

const stamp = (iso: string, startsAt?: string) => {
  if (startsAt) return `${startsAt.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`;
  return `${iso}T200000Z`;
};
const escape = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

/** Public diary feed: only published shows, never booking contact details. */
export default function calendar(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('GET required');
  }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const events = SHOWS
    .filter((show) => show.iso >= today)
    .map((show) => [
      'BEGIN:VEVENT',
      `UID:${show.iso}-${show.venue.replace(/\W+/g, '-').toLowerCase()}@djkcmusic.com`,
      `DTSTAMP:${stamp(show.iso, show.startsAt)}`,
      `DTSTART:${stamp(show.iso, show.startsAt)}`,
      `SUMMARY:${escape(`DJ KC · ${show.event}`)}`,
      `LOCATION:${escape(`${show.venue}, ${show.city}`)}`,
      `DESCRIPTION:${escape(`${show.note}. Status: published on the DJ KC site, not a live availability check.`)}`,
      'END:VEVENT',
    ].join('\r\n'));

  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DJ KC//Live dates//EN', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:DJ KC live dates', ...events, 'END:VCALENDAR'].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="dj-kc-dates.ics"');
  res.setHeader('Cache-Control', 'public, max-age=1800');
  res.statusCode = 200;
  res.end(`${body}\r\n`);
}
