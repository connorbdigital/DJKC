/**
 * The business behind the site, in one place.
 *
 * UK consumer law wants a trader to say who it is before it takes money, and a
 * privacy notice wants the same. Rather than write those into a page and let
 * them drift, they live here: the footer, the terms page and the privacy page
 * all read from this object, so there is one copy of the answer.
 *
 * Anything left empty is *not* printed. An empty address is better than a
 * guessed one — a wrong address in a legal notice is worse than saying "ask and
 * we'll send it".
 */
import { BOOKING_EMAIL } from "./data.ts";

export interface Trading {
  /** The name she trades under. */
  name: string;
  email: string;
  /** Postal address for the business. Print only when it is real. */
  address: string;
  /** Company number, if it is a limited company. */
  companyNumber: string;
  /** VAT number, if registered. */
  vat: string;
}

export const TRADING: Trading = {
  name: "DJ KC",
  email: BOOKING_EMAIL,
  address: "",
  companyNumber: "",
  vat: "",
};

/** How long an enquiry is kept when it does not turn into a booking. */
export const ENQUIRY_RETENTION_MONTHS = 24;

/** How long booking and payment records are kept — accounting practice, not a guess. */
export const BOOKING_RETENTION_YEARS = 6;

/**
 * The identity block, as lines of text.
 *
 * Every line that can be printed truthfully is printed; the postal address is
 * the one field only the owner can supply, so until it exists the page says how
 * to get it rather than leaving a hole where a legal notice should be.
 */
export function tradingLines(trading: Trading = TRADING): string[] {
  const lines = [`Trading name: ${trading.name}`, `Email: ${trading.email}`];
  if (trading.address) lines.push(`Business address: ${trading.address}`);
  if (trading.companyNumber) lines.push(`Company number: ${trading.companyNumber}`);
  if (trading.vat) lines.push(`VAT number: ${trading.vat}`);
  if (!trading.address) {
    lines.push(`Postal address: ask by email and it is sent before you pay anything.`);
  }
  return lines;
}
