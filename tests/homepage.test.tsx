// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { Booking } from '../src/components/Booking';
import { Navbar } from '../src/components/Navbar';
import { calendarDate } from '../src/utils/dates';

const engine = vi.hoisted(() => ({ play: vi.fn(), setMuted: vi.fn(), setVolume: vi.fn(), dispose: vi.fn(), getElapsed: () => 0 }));
vi.mock('../src/audio', () => ({ HouseEngine: class { constructor() { return engine; } } }));
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('rejects yesterday and prepares an editable email, not a delivery confirmation', () => {
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  const submit = () => fireEvent.click(screen.getByText('Prepare email enquiry →'));
  submit();
  expect(screen.getAllByRole('alert')).toHaveLength(3);
  for (const [label, value] of [['Your name *','Alex'], ['Email *','alex@example.org'], ['Venue / event *','Hall & Bar']]) {
    fireEvent.change(screen.getByLabelText(label), {target: {value}});
  }
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  fireEvent.change(screen.getByLabelText('Date'), {target: {value: calendarDate(yesterday)}});
  submit();
  expect(screen.getByText('Choose today or a future date')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Date'), {target: {value: calendarDate()}});
  submit();
  const url = new URL(screen.getByRole('link', {name: 'Open email app'}).getAttribute('href')!);
  expect(url.protocol).toBe('mailto:');
  expect(url.searchParams.get('body')).toContain('Venue / event: Hall & Bar');
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
