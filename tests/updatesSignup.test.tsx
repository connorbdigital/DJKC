// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UPDATES_DELAY_MS, UPDATES_STORAGE_KEY, UpdatesSignup } from '../src/components/UpdatesSignup';
import { BookingChat } from '../src/components/BookingChat';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('waits before inviting people to join the list', async () => {
  render(<UpdatesSignup />);
  await act(async () => { await vi.advanceTimersByTimeAsync(UPDATES_DELAY_MS - 2000); });
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(2200); });
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Get the next dates first' })).toBeTruthy();
});

it('stays gone once dismissed, and remembers for a month', async () => {
  render(<UpdatesSignup />);
  await act(async () => { await vi.advanceTimersByTimeAsync(UPDATES_DELAY_MS); });
  fireEvent.click(screen.getByRole('button', { name: 'Close updates sign-up' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(localStorage.getItem(UPDATES_STORAGE_KEY)).not.toBeNull();
  cleanup();
  render(<UpdatesSignup />);
  await act(async () => { await vi.advanceTimersByTimeAsync(UPDATES_DELAY_MS * 2); });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('validates the address and opens a ready-to-send email rather than claiming a subscription', async () => {
  render(<UpdatesSignup />);
  await act(async () => { await vi.advanceTimersByTimeAsync(UPDATES_DELAY_MS); });
  fireEvent.change(screen.getByLabelText('Your email address'), { target: { value: 'nope' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  expect(screen.getByRole('alert').textContent).toContain("doesn't look right");
  fireEvent.change(screen.getByLabelText('Your email address'), { target: { value: 'alex@example.org' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join' }));
  const link = screen.getByRole('link', { name: 'Open email app' }).getAttribute('href')!;
  expect(link.startsWith('mailto:booking@djkcmusic.com')).toBe(true);
  expect(decodeURIComponent(link)).toContain('DJ KC updates list');
  expect(screen.queryByText(/you are subscribed/i)).toBeNull();
});

it('withdraws the chat invitation so the two cards never stack', async () => {
  render(<>
    <BookingChat />
    <UpdatesSignup />
  </>);
  expect(screen.getByRole('button', { name: /Chat to book your date/ })).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(UPDATES_DELAY_MS); });
  expect(screen.queryByRole('button', { name: /Chat to book your date/ })).toBeNull();
});
