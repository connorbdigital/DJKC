// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BookBar } from '../src/components/BookBar';
import { Booking } from '../src/components/Booking';
import { calendarDate } from '../src/utils/dates';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.cb([{ isIntersecting: false }]); }
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

/** The bar only appears once the page has been scrolled past the hero. */
function showBar() {
  Object.defineProperty(window, 'scrollY', { value: 900, configurable: true });
  fireEvent.scroll(window);
}

function withBookingSection() {
  const section = document.createElement('section');
  section.id = 'book';
  const name = document.createElement('input');
  name.id = 'bk-name';
  section.append(name);
  document.body.append(section);
  return section;
}

it('keeps a Book now button pointing at the booking form', () => {
  const section = withBookingSection();
  render(<BookBar />);
  showBar();
  const cta = screen.getByRole('link', { name: /Book now/i });
  expect(cta.getAttribute('href')).toBe('#book');
  expect(document.querySelector('.kc-bookbar')).toBeTruthy();
  expect(screen.getByText(/£650/)).toBeTruthy();
  expect(screen.getByText(/50% deposit/)).toBeTruthy();
  section.remove();
});

it('opens the form and asks for the holding deposit when tapped', () => {
  const section = withBookingSection();
  const spy = vi.fn();
  window.addEventListener('kc:pay-on-book', spy);
  render(<BookBar />);
  showBar();
  fireEvent.click(screen.getByRole('link', { name: /Book now/i }));
  expect(spy).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe('#book');
  window.removeEventListener('kc:pay-on-book', spy);
  section.remove();
});

it('pre-selects the deposit on the form without overriding a choice already made', () => {
  render(<Booking tier="Signature Live" onTier={() => {}} />);
  const deposit = screen.getByRole('radio', { name: /holding deposit/ }) as HTMLInputElement;
  const none = screen.getByRole('radio', { name: /No payment now/ }) as HTMLInputElement;
  expect(none.checked).toBe(true);

  act(() => { window.dispatchEvent(new CustomEvent('kc:pay-on-book')); });
  expect(deposit.checked).toBe(true);

  fireEvent.click(screen.getByRole('radio', { name: /Pay in full/ }));
  act(() => { window.dispatchEvent(new CustomEvent('kc:pay-on-book')); });
  expect((screen.getByRole('radio', { name: /Pay in full/ }) as HTMLInputElement).checked).toBe(true);
  expect(calendarDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
