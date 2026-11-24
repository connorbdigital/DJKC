// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Booking } from '../src/components/Booking';
import { calendarDate } from '../src/utils/dates';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const fill = () => {
  fireEvent.change(screen.getByLabelText('Your name *'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'alex@example.org' } });
  fireEvent.change(screen.getByLabelText('Venue / event *'), { target: { value: 'Freight Island' } });
};

it('shows the list price and both payment amounts for the chosen package', () => {
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  // The quote panel and the matching payment option both show the figure.
  expect(screen.getAllByText('£1,100').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('£550')).toBeTruthy(); // 50% deposit
  expect(screen.getByRole('radio', { name: /No payment now/ })).toBeTruthy();
  expect(screen.getByRole('radio', { name: /50% holding deposit/ })).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Pay in full/ })).toBeTruthy();
});

it('recalculates deposit and full payment from a suggested budget', () => {
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  fireEvent.change(screen.getByLabelText('Your budget (optional)'), { target: { value: '900' } });
  expect(screen.getByText('£450')).toBeTruthy();
  expect(screen.getAllByText('£900').length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText('£1,100')).toBeNull();
});

it('asks a custom enquiry to name its own budget', () => {
  render(<Booking tier="Festival / Takeover" onTier={() => {}} />);
  expect(screen.getByText('Name your budget')).toBeTruthy();
  expect(screen.getByLabelText('Your suggested budget *')).toBeTruthy();
  expect(screen.getByText(/what the night is worth to you/i)).toBeTruthy();
});

it('sends the budget and the payment choice with the request', async () => {
  const fetch = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(
    String(url).startsWith('/api/availability')
      ? { ok: true, json: async () => ({ status: 'open' }) }
      : { ok: true, json: async () => ({ ok: true, id: 'BK-ABC123', amount: 550, mode: 'deposit', paymentUrl: 'https://checkout.stripe.test/cs_1' }) }
  ) as unknown as Promise<Response>);
  vi.stubGlobal('fetch', fetch);

  render(<Booking tier="Signature Live" onTier={() => {}} />);
  fill();
  fireEvent.change(screen.getByLabelText('Your budget (optional)'), { target: { value: '1100' } });
  fireEvent.click(screen.getByRole('radio', { name: /50% holding deposit/ }));
  fireEvent.click(screen.getByText('Send booking request →'));

  await waitFor(() => expect(screen.getByText(/Pay the £550 deposit/)).toBeTruthy());
  const call = fetch.mock.calls.find(([url]) => String(url) === '/api/bookings');
  const body = JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
  expect(body.offer).toBe(1100);
  expect(body.pay).toBe('deposit');
});

it('blocks payment when there is no number to charge', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<Booking tier="Not sure yet" onTier={() => {}} />);
  fill();
  fireEvent.click(screen.getByRole('radio', { name: /Pay in full/ }));
  fireEvent.click(screen.getByText('Send booking request →'));
  expect(screen.getByText('Add the budget you have in mind so we can work out the payment')).toBeTruthy();
  expect(fetch.mock.calls.some(([url]) => String(url) === '/api/bookings')).toBe(false);
});

it('rejects a budget under the floor before sending', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<Booking tier="Not sure yet" onTier={() => {}} />);
  fill();
  fireEvent.change(screen.getByLabelText('Your suggested budget *'), { target: { value: '40' } });
  fireEvent.click(screen.getByText('Send booking request →'));
  expect(screen.getByText(/Suggest anything from/)).toBeTruthy();
  expect(fetch.mock.calls.some(([url]) => String(url) === '/api/bookings')).toBe(false);
});

it('confirms a full payment on return from Stripe', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ paid: true, id: 'BK-4F2A9C', amount: 1100, mode: 'full', label: 'Payment received' }),
  })));
  window.history.replaceState({}, '', '/?deposit=cs_full#book');
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  await waitFor(() => expect(screen.getByText(/the payment is paid|£1,100/)).toBeTruthy());
  window.history.replaceState({}, '', '/');
  expect(calendarDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
