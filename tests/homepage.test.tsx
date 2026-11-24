// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { Booking } from '../src/components/Booking';
import { Navbar } from '../src/components/Navbar';
import { existsSync, readFileSync } from 'node:fs';
import { calendarDate } from '../src/utils/dates';

const engine = vi.hoisted(() => ({ play: vi.fn(), setMuted: vi.fn(), setVolume: vi.fn(), dispose: vi.fn(), getElapsed: () => 0 }));
vi.mock('../src/audio', () => ({ HouseEngine: class { constructor() { return engine; } } }));
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('shows sterling prices in the hero, packages and booking selector', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /Club sets from £650/ })).toBeTruthy();
  const pricing = document.getElementById('pricing')!;
  expect(pricing.textContent).toContain('£650');
  expect(pricing.textContent).toContain('£1,100');
  expect(pricing.textContent).toContain('Travel included across the North West');
  expect(pricing.textContent).not.toContain('Travel within Ireland');
  expect(screen.getByRole('option', { name: /Club Night — £650/ })).toBeTruthy();
  expect(screen.getByRole('option', { name: /Signature Live — £1,100/ })).toBeTruthy();
});

it('rejects missing details and past dates before sending anything', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  const submit = () => fireEvent.click(screen.getByText('Send booking request →'));
  submit();
  expect(screen.getAllByRole('alert')).toHaveLength(3);
  for (const [label, value] of [['Your name *','Alex'], ['Email *','alex@example.org'], ['Venue / event *','Hall & Bar']]) {
    fireEvent.change(screen.getByLabelText(label), {target: {value}});
  }
  fireEvent.change(screen.getByLabelText('Booking area (optional)'), { target: { value: 'UK — North West' } });
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  fireEvent.change(screen.getByLabelText('Date'), {target: {value: calendarDate(yesterday)}});
  submit();
  expect(screen.getByText('Choose today or a future date')).toBeTruthy();
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/bookings'))).toBe(false);
});

it('sends a stored booking request and shows the reference without claiming a confirmed date', async () => {
  const fetch = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(
    String(url).startsWith('/api/availability')
      ? { ok: true, json: async () => ({ status: 'open' }) }
      : { ok: true, json: async () => ({ ok: true, id: 'BK-ABC123', status: 'requested' }) }
  ) as unknown as Promise<Response>);
  vi.stubGlobal('fetch', fetch);
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  fireEvent.change(screen.getByLabelText('Your name *'), {target: {value: 'Alex'}});
  fireEvent.change(screen.getByLabelText('Email *'), {target: {value: 'alex@example.org'}});
  fireEvent.change(screen.getByLabelText('Venue / event *'), {target: {value: 'Hall & Bar'}});
  fireEvent.change(screen.getByLabelText('Booking area (optional)'), {target: {value: 'UK — North West'}});
  fireEvent.change(screen.getByLabelText('Date'), {target: {value: calendarDate()}});
  fireEvent.click(screen.getByText('Send booking request →'));
  expect(await screen.findByText('Request received')).toBeTruthy();
  expect(screen.getByText('BK-ABC123')).toBeTruthy();
  expect(screen.getByText(/Nothing is booked until she confirms/)).toBeTruthy();
  const [, init] = fetch.mock.calls.find(([u]) => String(u) === '/api/bookings')!;
  expect(JSON.parse(String(init?.body))).toMatchObject({
    name: 'Alex', email: 'alex@example.org', venue: 'Hall & Bar',
    area: 'UK — North West', package: 'Signature Live',
  });
  expect(screen.queryByLabelText('Enquiry draft')).toBeNull();
});

it('falls back to an editable email when the booking desk cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  for (const [label, value] of [['Your name *','Alex'], ['Email *','alex@example.org'], ['Venue / event *','Hall & Bar']]) {
    fireEvent.change(screen.getByLabelText(label), {target: {value}});
  }
  fireEvent.change(screen.getByLabelText('Booking area (optional)'), { target: { value: 'UK — North West' } });
  fireEvent.change(screen.getByLabelText('Date'), {target: {value: calendarDate()}});
  fireEvent.click(screen.getByText('Send booking request →'));
  const link = (await screen.findByRole('link', {name: 'Open email app'})).getAttribute('href')!;
  const url = new URL(link);
  expect(url.protocol).toBe('mailto:');
  expect(url.searchParams.get('body')).toContain('Area: UK — North West');
  expect(url.searchParams.get('body')).toContain('Package: Signature Live');
  fireEvent.click(screen.getByText('Edit enquiry'));
  expect(screen.getByDisplayValue('alex@example.org')).toBeTruthy();
});

it('plays a different track on first click and preserves mute on Next', async () => {
  engine.play.mockResolvedValue(true);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Play Golden Hour' }));
  await screen.findByRole('button', { name: 'Pause Golden Hour' });
  expect(engine.play).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
  await screen.findByRole('button', { name: 'Pause Warehouse Heart' });
  expect(engine.setMuted).toHaveBeenLastCalledWith(true);
});

it('exposes a recoverable error when audio cannot start', async () => {
  engine.play.mockRejectedValueOnce(new Error('blocked'));
  render(<App />);
  fireEvent.click(screen.getByRole('button', {name: 'Play Golden Hour'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Audio could not start');
  expect(screen.queryByRole('button', {name: 'Pause Golden Hour'})).toBeNull();
});

it('opens a native modal and releases the scroll lock on keyboard cancellation', async () => {
  // jsdom lacks the browser dialog API; simulate its open attribute only.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<Navbar active="" playing={false} muted={false} onSound={() => {}} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  const dialog = screen.getByRole('dialog');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent(dialog, new Event('cancel'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.body.style.overflow).toBe('');
});


it('filters live dates to the North West', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'North West' }));
    expect(screen.getByText('House That Moves — UK Debut')).toBeTruthy();
    expect(screen.getByText('North West Takeover — KC & Friends')).toBeTruthy();
    expect(screen.queryByText('Playhouse — Guest Set')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it('leads with the North West home turf in coverage and testimonials', () => {
  render(<App />);
  const areaNames = [...document.querySelectorAll('#shows summary')].map(n => n.textContent).filter(t => t?.includes('—') || t === 'Ireland');
  expect(areaNames[0]).toBe('UK — North West — Home Turf');
  expect(areaNames).toContain('Ireland');
  expect(screen.getByRole('option', { name: 'UK — North West' })).toBeTruthy();
  const voices = document.getElementById('voices')!;
  expect(voices.textContent).toContain('Freight Island, Manchester');
  expect(voices.textContent).toContain('Callum Webb');
});

it('describes the North West base in metadata for search and link previews', () => {
  const html = readFileSync('index.html', 'utf8');
  const meta = (name: string) => html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1] ?? '';
  expect(meta('description')).toContain('North West');
  expect(meta('description')).toContain('Manchester');
  expect(meta('description')).toMatch(/Hire DJ KC/);
  expect(meta('og:title')).toContain('North West');
  expect(html).not.toMatch(/Cork, Ireland/);
  expect(html).toContain('"homeLocation"');
  expect(html).toContain('North West England');
  expect(html).toContain('content="https://kaysie.sitebuildup.co.uk/og.jpg"');
  expect(existsSync('public/og.jpg')).toBe(true);
});
