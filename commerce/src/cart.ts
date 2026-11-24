import { add, clampAtZero, money, percentOf, subtract, sum, times, type Currency, type Money } from "./money";
import { availability, variantBySku, type Product } from "./catalog";

/**
 * The basket.
 *
 * Two rules drive everything below: the shopper sees the real total as early as
 * possible (delivery and tax included, not revealed at payment), and the basket
 * never silently changes what it is charging.
 */
export interface CartLine {
  sku: string;
  quantity: number;
}

export interface Cart {
  currency: Currency;
  lines: CartLine[];
  discountCode?: string;
}

export interface Discount {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  /** Spend needed before the discount can be used. */
  minSpend?: Money;
  /** Ceiling for percentage codes. */
  maxDiscount?: Money;
  /** Which categories it applies to; empty means everything. */
  categories?: string[];
}

export interface ShippingRule {
  /** Free delivery at or above this subtotal. */
  freeOver?: Money;
  /** Flat charge below the threshold. */
  flat?: Money;
  /** Never deliver below this subtotal. */
  minOrder?: Money;
  label: string;
  estimate: string;
}

export interface PricedLine {
  sku: string;
  title: string;
  category: string;
  quantity: number;
  unit: Money;
  line: Money;
  /** Stock left after this line. */
  remaining: number;
}

export interface CartIssue {
  sku: string;
  problem: "unknown-sku" | "out-of-stock" | "not-enough-stock" | "zero-quantity";
  detail: string;
}

export interface PricedCart {
  currency: Currency;
  lines: PricedLine[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  /** What the shopper pays, delivery included. */
  total: Money;
  /** Tax already inside the total (UK prices are VAT-inclusive). */
  taxIncluded: Money;
  issues: CartIssue[];
  discountApplied: Discount | null;
  discountRejected: string | null;
  /** At most one message, phrased as the next action. */
  message: string;
}

export function emptyCart(currency: Currency = "GBP"): Cart {
  return { currency, lines: [] };
}

/** Add or replace a line. Adding the same SKU twice increases the quantity. */
export function addToCart(cart: Cart, sku: string, quantity = 1): Cart {
  if (quantity <= 0) return removeLine(cart, sku);
  const existing = cart.lines.find((line) => line.sku === sku);
  const lines = existing
    ? cart.lines.map((line) => (line.sku === sku ? { ...line, quantity: line.quantity + quantity } : line))
    : [...cart.lines, { sku, quantity }];
  return { ...cart, lines };
}

export function setQuantity(cart: Cart, sku: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, sku);
  return { ...cart, lines: cart.lines.map((line) => (line.sku === sku ? { ...line, quantity } : line)) };
}

export const removeLine = (cart: Cart, sku: string): Cart => ({ ...cart, lines: cart.lines.filter((line) => line.sku !== sku) });

export const itemCount = (cart: Cart): number => cart.lines.reduce((count, line) => count + line.quantity, 0);

export interface PricingContext {
  products: Product[];
  /** VAT rate for the currency's country, as a percentage of the gross. */
  vatRate?: number;
  shipping?: ShippingRule;
  discounts?: Discount[];
}

/** Deterministic pricing: same basket and catalogue in, same totals out. */
export function priceCart(cart: Cart, context: PricingContext): PricedCart {
  const vatRate = context.vatRate ?? 20;
  const issues: CartIssue[] = [];
  const lines: PricedLine[] = [];

  for (const line of cart.lines) {
    if (line.quantity <= 0) {
      issues.push({ sku: line.sku, problem: "zero-quantity", detail: "Quantity is zero — remove the line instead." });
      continue;
    }
    const found = variantBySku(context.products, line.sku);
    if (!found) {
      issues.push({ sku: line.sku, problem: "unknown-sku", detail: `${line.sku} is no longer sold.` });
      continue;
    }
    const { product, variant } = found;
    if (availability(variant) === "OutOfStock") {
      issues.push({ sku: line.sku, problem: "out-of-stock", detail: `${product.title} is out of stock.` });
      continue;
    }
    if (line.quantity > variant.stock && !variant.madeToOrder) {
      issues.push({
        sku: line.sku,
        problem: "not-enough-stock",
        detail: `Only ${variant.stock} of ${product.title} left — quantity was ${line.quantity}.`,
      });
      continue;
    }
    lines.push({
      sku: line.sku,
      title: [product.title, variant.title].filter(Boolean).join(" · "),
      category: product.category,
      quantity: line.quantity,
      unit: variant.price,
      line: times(variant.price, line.quantity),
      remaining: Math.max(0, variant.stock - line.quantity),
    });
  }

  const subtotal = sum(lines.map((line) => line.line), cart.currency);
  const { discount, applied, rejected } = applyDiscount(cart, subtotal, lines, context.discounts ?? []);
  /* An empty basket is not delivered: no charge for nothing. */
  const shipping = lines.length ? shippingFor(subtotal, context.shipping, cart.currency) : money(0, cart.currency);
  const total = clampAtZero(add(add(subtotal, shipping), money(-discount.amount, cart.currency)));
  const taxIncluded = money(Math.round((total.amount * vatRate) / (100 + vatRate)), cart.currency);

  return {
    currency: cart.currency,
    lines,
    subtotal,
    discount,
    shipping,
    total,
    taxIncluded,
    issues,
    discountApplied: applied,
    discountRejected: rejected,
    message: nextMessage({ lines, issues, shipping: context.shipping, subtotal, total }),
  };
}

function applyDiscount(
  cart: Cart,
  subtotal: Money,
  lines: PricedLine[],
  discounts: Discount[]
): { discount: Money; applied: Discount | null; rejected: string | null } {
  const none = { discount: money(0, cart.currency), applied: null, rejected: null };
  if (!cart.discountCode) return none;
  const code = cart.discountCode.trim().toUpperCase();
  const match = discounts.find((entry) => entry.code.toUpperCase() === code);
  if (!match) return { ...none, rejected: `${code} is not a valid code.` };
  if (match.minSpend && subtotal.amount < match.minSpend.amount) {
    return {
      ...none,
      rejected: `${code} needs a basket of ${(match.minSpend.amount / 100).toFixed(2)} or more.`,
    };
  }

  const eligible = match.categories?.length
    ? lines.filter((line) => match.categories!.includes(line.category))
    : lines;
  const eligibleTotal = sum(eligible.map((line) => line.line), cart.currency);

  const raw = match.kind === "percent" ? percentOf(eligibleTotal, match.value) : money(Math.round(match.value), cart.currency);
  const capped = match.maxDiscount && raw.amount > match.maxDiscount.amount ? match.maxDiscount : raw;
  const discount = clampAtZero(capped.amount > subtotal.amount ? subtotal : capped);
  return { discount, applied: match, rejected: null };
}

function shippingFor(subtotal: Money, rule: ShippingRule | undefined, currency: Currency): Money {
  if (!rule) return money(0, currency);
  if (rule.minOrder && subtotal.amount < rule.minOrder.amount) return money(0, currency);
  if (rule.freeOver && subtotal.amount >= rule.freeOver.amount) return money(0, currency);
  return rule.flat ?? money(0, currency);
}

function nextMessage(input: {
  lines: PricedLine[];
  issues: CartIssue[];
  shipping?: ShippingRule;
  subtotal: Money;
  total: Money;
}): string {
  if (input.issues.length) return input.issues[0]!.detail;
  if (!input.lines.length) return "Your basket is empty.";
  if (input.shipping?.freeOver && input.subtotal.amount < input.shipping.freeOver.amount) {
    const short = subtract(input.shipping.freeOver, input.subtotal);
    return `Add ${(short.amount / 100).toFixed(2)} more for free delivery.`;
  }
  return `Total ${(input.total.amount / 100).toFixed(2)} including delivery.`;
}

/** What the checkout may say: stock that disappeared between basket and pay. */
export function stockConflicts(priced: PricedCart): CartIssue[] {
  return priced.issues.filter((issue) => issue.problem === "not-enough-stock" || issue.problem === "out-of-stock");
}
