import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEPOSIT_PERCENT, priceValue } from '../src/data.js';
import { BOOKINGS_KEY, type Booking } from './bookings.js';
import { command, store } from './store.js';

const SITE = process.env.SITE_URL || 'https://kaysie.sitebuildup.co.uk';

export type PayMode = 'deposit' | 'full';

/** Deposit share in percent — env override, kept sane. */
export function depositPercent(): number {
  const raw = Number(process.env.STRIPE_DEPOSIT_PERCENT ?? DEPOSIT_PERCENT);
  return Number.isFinite(raw) ? Math.min(100, Math.max(10, Math.round(raw))) : DEPOSIT_PERCENT;
}

/** Charge for a quote in pence: the whole fee, or the deposit share of it. */
export function chargeFor(pounds: number, mode: PayMode = 'deposit'): number {
  const pence = Math.round(pounds * 100);
  if (!Number.isFinite(pence) || pence <= 0) return 0;
  if (mode === 'full') return Math.max(100, pence);
  return Math.max(100, Math.round((pence * depositPercent()) / 100));
}

const money = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/**
 * Creates a Stripe Checkout session for an agreed quote: either the full fee or
 * the holding deposit. Returns null when Stripe is not configured, so a booking
 * request never fails just because payments are unavailable.
 */
export async function createCheckout(booking: Booking, pounds: number, mode: PayMode = 'deposit'): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  const amount = chargeFor(pounds, mode);
  if (!key || amount <= 0) return null;
  const percent = depositPercent();
  const label = mode === 'full' ? 'Full fee' : `${percent}% holding deposit`;
  const forWhen = `${booking.date || 'a date to confirm'} at ${booking.venue}`;
  const body = new URLSearchParams({
    mode: 'payment',
    success_url: `${SITE}/?deposit={CHECKOUT_SESSION_ID}#book`,
    cancel_url: `${SITE}/#book`,
    client_reference_id: booking.id,
    'metadata[bookingId]': booking.id,
    'metadata[mode]': mode,
    'metadata[quotedAmount]': String(pounds),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': mode === 'full' ? `DJ KC booking — ${booking.package}` : `DJ KC deposit — ${booking.package}`,
    'line_items[0][price_data][product_data][description]':
      `${label} of ${money(amount)} towards ${money(Math.round(pounds * 100))} for ${forWhen}. Refund terms are set in the booking contract.`,
  });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const session = (await response.json()) as { url?: string };
    return typeof session.url === 'string' ? session.url : null;
  } catch {
    return null;
  }
}

/** Convenience wrapper for a display price such as "£1,100". */
export async function createDeposit(booking: Booking, price: string, mode: PayMode = 'deposit'): Promise<string | null> {
  const pounds = priceValue(price);
  return pounds ? createCheckout(booking, pounds, mode) : null;
}

/** Confirms a payment on return from Stripe and records it against the booking. */
export default async function deposit(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: 'GET required' });
  }
  const sessionId = new URL(req.url ?? '/', 'https://example.com').searchParams.get('session_id') ?? '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return send(400, { error: 'Expected ?session_id=' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return send(503, { error: 'Payments unavailable' });

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return send(503, { error: 'Could not verify the payment' });
    const session = (await response.json()) as {
      payment_status?: string;
      client_reference_id?: string;
      amount_total?: number;
      metadata?: { bookingId?: string; mode?: string; quotedAmount?: string };
    };
    const bookingId = session.metadata?.bookingId || session.client_reference_id || '';
    if (session.payment_status !== 'paid' || !bookingId) return send(200, { paid: false });

    const mode: PayMode = session.metadata?.mode === 'full' ? 'full' : 'deposit';
    const amount = (session.amount_total ?? 0) / 100;
    const quoted = Number(session.metadata?.quotedAmount ?? 0) || undefined;

    const client = store();
    if (!client) return send(503, { error: 'Storage unavailable' });
    const { result } = await command(client, ['HGET', BOOKINGS_KEY, bookingId]);
    if (typeof result !== 'string') return send(404, { error: 'Booking not found' });
    const booking = JSON.parse(result) as Booking;
    /* Idempotent: a refreshed return URL must not rewrite the record or double-count. */
    if (!booking.depositPaid) {
      const updated: Booking = {
        ...booking,
        depositPaid: true,
        depositAmount: amount,
        paymentMode: mode,
        quotedAmount: quoted ?? booking.quotedAmount,
        paidAt: new Date().toISOString(),
      };
      await command(client, ['HSET', BOOKINGS_KEY, bookingId, JSON.stringify(updated)]);
    }
    return send(200, { paid: true, id: bookingId, amount, mode, label: mode === 'full' ? 'Payment received' : 'Deposit received' });
  } catch {
    return send(503, { error: 'Could not verify the payment' });
  }
}
