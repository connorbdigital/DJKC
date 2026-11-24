import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AREA_GROUPS, MAX_OFFER, MIN_OFFER, TIERS, priceValue } from '../src/data.js';
import { command, pairsFromHash, sameToken, store } from './store.js';
import { chargeFor, createCheckout, type PayMode } from './deposit.js';
import { notifyDesk } from './notify.js';

export const BOOKINGS_KEY = 'kc:bookings';
export const STATUSES = ['requested', 'confirmed', 'declined'] as const;
export type BookingStatus = (typeof STATUSES)[number];

export interface Booking {
  id: string;
  name: string;
  email: string;
  venue: string;
  area: string;
  date: string;
  package: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt?: string;
  notified?: boolean;
  /** Budget the enquirer suggested, in pounds, for custom or unsure packages. */
  offer?: number;
  /** The number the payment was worked out from, in pounds. */
  quotedAmount?: number;
  /** deposit = holding deposit, full = whole fee. Overwritten with what was actually paid. */
  paymentMode?: PayMode;
  depositPaid?: boolean;
  depositAmount?: number;
  paidAt?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PACKAGES = [...TIERS.map((t) => t.name), 'Not sure yet'];
const AREAS = AREA_GROUPS.map((a) => a.formValue);
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

let windowStart = 0;
let requests = 0;

async function read(client: ReturnType<typeof store> & object, id: string) {
  const { result } = await command(client, ['HGET', BOOKINGS_KEY, id]);
  return typeof result === 'string' ? (JSON.parse(result) as Booking) : null;
}

export default async function bookings(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  const client = store();

  if (req.method === 'POST') {
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON' });
    if (Date.now() - windowStart >= 3_600_000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (requests >= 12) return send(429, { error: 'Too many requests' });
    requests++;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = clean(body.name, 80);
    const email = clean(body.email, 254).toLowerCase();
    const venue = clean(body.venue, 120);
    const area = clean(body.area, 60);
    const date = isoDate(body.date);
    const pkg = clean(body.package, 40);
    const message = clean(body.message, 2000);
    const offerRaw = Number(body.offer);
    const offer = Number.isFinite(offerRaw) && offerRaw > 0 ? Math.round(offerRaw) : 0;
    const payRaw = clean(body.pay, 10);
    const pay: PayMode | 'none' = payRaw === 'full' ? 'full' : payRaw === 'deposit' ? 'deposit' : 'none';
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(Date.now() + 730 * 86_400_000).toISOString().slice(0, 10);

    if (name.length < 2) return send(400, { error: 'Tell KC who is asking' });
    if (!EMAIL.test(email)) return send(400, { error: 'Enter a valid email address' });
    if (venue.length < 2) return send(400, { error: 'Venue or event name required' });
    if (date && (date < today || date > limit)) return send(400, { error: 'Choose a date within the next two years' });
    if (!PACKAGES.includes(pkg)) return send(400, { error: 'Choose a package' });
    if (area && !AREAS.includes(area)) return send(400, { error: 'Choose a listed area' });
    if (offer && (offer < MIN_OFFER || offer > MAX_OFFER)) {
      return send(400, { error: `Suggest a budget between \u00a3${MIN_OFFER} and \u00a3${MAX_OFFER.toLocaleString('en-GB')}` });
    }

    /* The enquirer's own number wins when they named one; otherwise the list price. */
    const tier = TIERS.find((t) => t.name === pkg);
    const quote = offer || (tier ? priceValue(tier.price) : null) || null;
    if (pay !== 'none' && !quote) return send(400, { error: 'Add a budget so we can work out the payment' });
    if (!client) return send(503, { error: 'Bookings unavailable' });

    const booking: Booking = {
      id: `BK-${randomUUID().slice(0, 6).toUpperCase()}`,
      name, email, venue, area, date, package: pkg, message,
      status: 'requested',
      createdAt: new Date().toISOString(),
      ...(offer ? { offer } : {}),
      ...(quote ? { quotedAmount: quote } : {}),
      ...(pay !== 'none' ? { paymentMode: pay } : {}),
    };
    try {
      const settled = await command(client, ['HSET', BOOKINGS_KEY, booking.id, JSON.stringify(booking)]);
      if (settled.result === undefined && !('result' in settled)) throw new Error('not stored');
      const notified = await notifyDesk(booking);
      /* Always mint a deposit link when a price is known, so the desk can still
         ask for it later — paying up front is the enquirer's choice, not a gate. */
      const mode: PayMode = pay === 'full' ? 'full' : 'deposit';
      const paymentUrl = quote ? await createCheckout(booking, quote, mode) : null;
      const amount = quote ? chargeFor(quote, mode) / 100 : null;
      return send(201, {
        ok: true, id: booking.id, status: booking.status, notified,
        depositUrl: paymentUrl, paymentUrl, amount, mode: pay, quotedAmount: quote,
      });
    } catch {
      return send(503, { error: 'Bookings unavailable' });
    }
  }

  const expected = process.env.BOOKINGS_TOKEN;
  const admin = process.env.ADMIN_TOKEN;
  if (!expected && !admin) return send(503, { error: 'Set BOOKINGS_TOKEN to manage bookings' });
  if (!sameToken(req.headers.authorization, expected, admin)) return send(401, { error: 'Unauthorised' });
  if (!client) return send(503, { error: 'Bookings unavailable' });

  try {
    if (req.method === 'GET') {
      const { result } = await command(client, ['HGETALL', BOOKINGS_KEY]);
      const rows = pairsFromHash(result)
        .map(([, value]) => { try { return JSON.parse(value) as Booking; } catch { return null; } })
        .filter((b): b is Booking => Boolean(b))
        .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.createdAt.localeCompare(b.createdAt));
      if (new URL(req.url ?? '/', 'https://example.com').searchParams.get('format') === 'json') {
        return send(200, { count: rows.length, bookings: rows });
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dj-kc-bookings.csv"');
      res.statusCode = 200;
      return res.end([
        'id,status,date,package,area,name,email,venue,created_at,quoted,paid,mode,message',
        ...rows.map((b) => [b.id, b.status, b.date, b.package, b.area, b.name, b.email, b.venue, b.createdAt,
          b.quotedAmount ?? '', b.depositAmount ?? '', b.paymentMode ?? '', b.message].map((v) => csvCell(String(v ?? ''))).join(',')),
      ].join('\n'));
    }

    if (req.method === 'PATCH') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON' });
      const body = (req.body ?? {}) as { id?: unknown; status?: unknown };
      const id = clean(body.id, 20);
      const status = clean(body.status, 12) as BookingStatus;
      if (!STATUSES.includes(status)) return send(400, { error: 'Unknown status' });
      const existing = await read(client, id);
      if (!existing) return send(404, { error: 'Booking not found' });
      const updated: Booking = { ...existing, status, updatedAt: new Date().toISOString() };
      await command(client, ['HSET', BOOKINGS_KEY, id, JSON.stringify(updated)]);
      return send(200, { ok: true, booking: updated });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return send(405, { error: 'Method not allowed' });
  } catch {
    return send(503, { error: 'Bookings unavailable' });
  }
}
