/**
 * Money as integers, always.
 *
 * Every price in this framework is an amount in minor units (pence for GBP)
 * with an explicit ISO 4217 currency. Floats are the reason carts show 1p
 * discrepancies at the wrong moment; nothing here multiplies or divides a
 * decimal.
 */
export type Currency = "GBP" | "EUR" | "USD";

export interface Money {
  /** Minor units: 1999 is £19.99. Never a decimal. */
  amount: number;
  currency: Currency;
}

export function money(amount: number, currency: Currency = "GBP"): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money must be whole minor units; got ${amount}. Multiply by 100 first.`);
  }
  return { amount, currency };
}

export function zero(currency: Currency = "GBP"): Money {
  return { amount: 0, currency };
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot combine ${a.currency} with ${b.currency}.`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export const sum = (values: Money[], currency: Currency = "GBP"): Money =>
  values.reduce<Money>((total, value) => add(total, value), zero(currency));

/** Multiply by a whole quantity. Caps at zero rather than going negative. */
export function times(price: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a whole number, zero or more; got ${quantity}.`);
  }
  return { amount: price.amount * quantity, currency: price.currency };
}

/** A percentage of an amount, rounded half-up to the nearest penny. */
export function percentOf(value: Money, percent: number): Money {
  if (percent < 0 || percent > 100) throw new Error(`Percentage out of range: ${percent}.`);
  return { amount: Math.round((value.amount * percent) / 100), currency: value.currency };
}

/** Never below zero: a discount larger than the basket simply empties it. */
export function clampAtZero(value: Money): Money {
  return value.amount < 0 ? { amount: 0, currency: value.currency } : value;
}

export function isZero(value: Money): boolean {
  return value.amount === 0;
}

/**
 * Splits a tax-inclusive price into the tax element. UK prices are shown
 * including VAT, so the shelf price is the gross; the invoice needs the split.
 */
export function vatIncluded(gross: Money, ratePercent: number): { net: Money; tax: Money } {
  if (ratePercent < 0) throw new Error(`VAT rate must not be negative: ${ratePercent}.`);
  const tax = Math.round((gross.amount * ratePercent) / (100 + ratePercent));
  return { net: { amount: gross.amount - tax, currency: gross.currency }, tax: { amount: tax, currency: gross.currency } };
}

const LOCALE: Record<Currency, string> = { GBP: "en-GB", EUR: "de-DE", USD: "en-US" };

/** "£19.99". Two decimals for the shopper, minor units for the machine. */
export function format(value: Money): string {
  return new Intl.NumberFormat(LOCALE[value.currency], {
    style: "currency",
    currency: value.currency,
  }).format(value.amount / 100);
}

/** "19.99" — the decimal string schema.org wants in an Offer. */
export function toDecimalString(value: Money): string {
  const sign = value.amount < 0 ? "-" : "";
  const absolute = Math.abs(value.amount);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
