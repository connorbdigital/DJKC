/** Types for the plain-JS checkout logic. The functions are the documentation. */

export interface CatalogueEntry {
  id: string;
  sku: string;
  name: string;
  slug: string;
  priceMinor: number;
  available: boolean;
  image: string;
}

export interface Delivery {
  freeOver: number;
  standard: number;
  express: number;
  expressInDays: [number, number] | number[];
}

export interface PricedLine {
  id: string;
  name: string;
  image: string;
  unitMinor: number;
  qty: number;
  lineMinor: number;
}

export interface Priced {
  ok: boolean;
  problems: string[];
  lines: PricedLine[];
  subtotal: number;
  shipping: number;
  total: number;
  freeOver: number;
}

export const DELIVERY: Delivery;
export function requestedLines(items: unknown): { id: string; qty: number }[];
export function priceBasket(catalogue: CatalogueEntry[], items: unknown, delivery?: Delivery): Priced;
export function shippingFor(subtotal: number, delivery?: Delivery): number;
export function formatMoney(minor: number): string;
export function basketNote(priced: Priced): string;
export function sessionBody(input: {
  lines: PricedLine[];
  shipping: number;
  baseUrl: string;
  successPath: string;
  cancelPath: string;
  delivery?: Delivery;
}): URLSearchParams;
