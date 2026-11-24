import type { Booking } from './bookings.js';

/**
 * Emails the desk when a request lands. Optional: without RESEND_API_KEY and
 * NOTIFY_EMAIL the booking is still stored, so a mail outage never loses a lead.
 */
export async function notifyDesk(booking: Booking): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return false;
  const from = process.env.NOTIFY_FROM || 'DJ KC bookings <onboarding@resend.dev>';
  const lines = [
    `Reference: ${booking.id}`,
    `Date: ${booking.date || 'to confirm'}`,
    `Package: ${booking.package}`,
    `Area: ${booking.area || 'not given'}`,
    `Venue / event: ${booking.venue}`,
    `Name: ${booking.name}`,
    `Reply to: ${booking.email}`,
    '',
    booking.message || '(no message)',
  ];
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: booking.email,
        subject: `New booking request · ${booking.date || 'date to confirm'} · ${booking.venue}`,
        text: lines.join('\n'),
      }),
      signal: AbortSignal.timeout(6000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
