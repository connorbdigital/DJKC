import type { IncomingMessage, ServerResponse } from 'node:http';
import { BOOKINGS_KEY, type Booking } from './bookings.js';
import { command, store } from './store.js';

const SITE = process.env.SITE_URL || 'https://kaysie.sitebuildup.co.uk';
export const DEPOSIT_PERCENT = Number(process.env.STRIPE_DEPOSIT_PERCENT || 50);

const priceOf = (value: string) => {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

/** Creates a Stripe Checkout session for a deposit; null when Stripe is not configured. */
export async function createDeposit(booking: Booking, price: string): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  const pounds = priceOf(price);
  if (!key || !pounds) return null;
  const amount = Math.max(100, Math.round((pounds * DEPOSIT_PERCENT) / 100 * 100));
  const body = new URLSearchParams({
    mode: 'payment',
    success_url: `${SITE}/?deposit={CHECKOUT_SESSION_ID}#book`,
    cancel_url: `${SITE}/#book`,
    client_reference_id: booking.id,
    'metadata[bookingId]': booking.id,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `DJ KC deposit — ${booking.package}`,
    'line_items[0][price_data][product_data][description]':
      `${DEPOSIT_PERCENT}% holding deposit for ${booking.date || 'a date to confirm'} at ${booking.venue}. Refund terms are set in the booking contract.`,
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
      metadata?: { bookingId?: string };
    };
    const bookingId = session.metadata?.bookingId || session.client_reference_id || '';
    if (session.payment_status !== 'paid' || !bookingId) return send(200, { paid: false });

    const client = store();
    if (!client) return send(503, { error: 'Storage unavailable' });
    const { result } = await command(client, ['HGET', BOOKINGS_KEY, bookingId]);
    if (typeof result !== 'string') return send(404, { error: 'Booking not found' });
    const booking = JSON.parse(result) as Booking;
    if (!booking.depositPaid) {
      const updated = { ...booking, depositPaid: true, depositAmount: (session.amount_total ?? 0) / 100, paidAt: new Date().toISOString() };
      await command(client, ['HSET', BOOKINGS_KEY, bookingId, JSON.stringify(updated)]);
    }
    return send(200, { paid: true, id: bookingId, amount: (session.amount_total ?? 0) / 100 });
  } catch {
    return send(503, { error: 'Could not verify the payment' });
  }
}
