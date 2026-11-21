// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BookingChat } from '../src/components/BookingChat';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<BookingChat />);
  fireEvent.click(screen.getByRole('button', {name:'Open booking chat'}));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows sterling package guidance locally, then hands off to the booking form', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  fireEvent.click(screen.getByRole('button', {name:'Starting fees'}));
  expect(screen.getByRole('log').textContent).toContain('Signature Live: from £1,100');
  expect(fetch).not.toHaveBeenCalled();
  const link = screen.getByRole('link', {name:/Continue to booking/});
  expect(link.getAttribute('href')).toBe('#book');
  fireEvent.click(link);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it.each([true,false])('labels replies honestly (provider available: %s)', async available => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:available,json:async () => ({reply:'Club nights start from £650.'})}));
  fireEvent.change(screen.getByLabelText('Your booking question'), {target:{value:'How much is a club night?'}});
  fireEvent.click(screen.getByRole('button', {name:'Send'}));
  expect(await screen.findByText(available ? 'AI assistant' : 'Booking guide · AI unavailable')).toBeTruthy();
  expect(screen.getByRole('log').textContent).toContain('£650');
});
