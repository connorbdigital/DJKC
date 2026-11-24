import { BRAND, CATEGORY_ALIASES, DEPARTMENTS, type Department } from "../catalogue/site";
import { availability, listPrice, type Product, type Variant } from "./catalog";
import { format, money, type Money } from "./money";

/**
 * The decisions a shop makes about its own catalogue: which department a product
 * belongs to, what delivery costs at a given basket, how stock is described, and
 * what the "key facts" table says. Pure functions, so the pages, the feed and
 * the structured data can never disagree with each other.
 */

export const OTHER_DEPARTMENT: Department = {
  id: "other",
  label: "More from the shop",
  blurb: "Everything that has not found its department yet.",
  why: "A supplier file will always contain something that does not fit the taxonomy. It gets a home rather than being dropped.",
  sections: [],
};

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function departmentFor(category: string, departments: Department[] = DEPARTMENTS): Department {
  const key = normalise(category.split(/[>|/]/)[0] ?? "");
  if (!key) return OTHER_DEPARTMENT;
  const mapped = CATEGORY_ALIASES[key];
  const found = departments.find((entry) => entry.id === (mapped ?? key)) ?? departments.find((entry) => normalise(entry.label) === key);
  return found ?? OTHER_DEPARTMENT;
}

export interface DepartmentGroup {
  department: Department;
  products: Product[];
}

/** Departments in navigation order, including the empty ones (honest, not hidden). */
export function groupByDepartment(products: Product[], departments: Department[] = DEPARTMENTS): DepartmentGroup[] {
  const groups = departments.map((department) => ({
    department,
    products: products.filter((product) => departmentFor(product.category, departments).id === department.id),
  }));
  const loose = products.filter((product) => departmentFor(product.category, departments).id === OTHER_DEPARTMENT.id);
  return loose.length ? [...groups, { department: OTHER_DEPARTMENT, products: loose }] : groups;
}

export const countIn = (groups: DepartmentGroup[], id: string) =>
  groups.find((group) => group.department.id === id)?.products.length ?? 0;

export interface DeliveryQuote {
  /** What the shopper is told. */
  label: string;
  minor: number;
  free: boolean;
  /** Spent so far towards free delivery, 0–100. */
  progress: number;
  remaining: number;
}

/** Free over the threshold, flat rate under it — said before payment, not after. */
export function deliveryFor(subtotal: Money, brand = BRAND): DeliveryQuote {
  const threshold = brand.delivery.freeOver;
  if (subtotal.amount >= threshold) {
    return { label: "Free delivery", minor: 0, free: true, progress: 100, remaining: 0 };
  }
  return {
    label: `${format(money(brand.delivery.standard, subtotal.currency))} delivery`,
    minor: brand.delivery.standard,
    free: false,
    progress: Math.round((subtotal.amount / threshold) * 100),
    remaining: threshold - subtotal.amount,
  };
}

/** The one-line promise shown on a card: the cost, plus when it arrives. */
export function deliveryLine(product: Product, brand = BRAND): string {
  const price = listPrice(product);
  if (!price) return "Delivery calculated at checkout";
  if (price.amount >= brand.delivery.freeOver) {
    const [min, max] = brand.delivery.standardDays;
    return `Free delivery · ${min}–${max} working days`;
  }
  return `+ ${format(money(brand.delivery.standard, price.currency))} delivery · free over ${format(
    money(brand.delivery.freeOver, price.currency)
  )}`;
}

export interface StockLine {
  text: string;
  tone: "in" | "low" | "out";
  /** Schema.org availability URL, so the page and the feed agree. */
  schema: string;
}

export function stockLabel(variant: Variant, lowStock = 5): StockLine {
  const state = availability(variant);
  if (state === "OutOfStock") {
    return { text: "Out of stock — back soon", tone: "out", schema: "https://schema.org/OutOfStock" };
  }
  if (state === "BackOrder" || state === "PreOrder") {
    return { text: "Available to pre-order", tone: "low", schema: "https://schema.org/PreOrder" };
  }
  if (variant.stock > 0 && variant.stock <= lowStock) {
    return { text: `Only ${variant.stock} left`, tone: "low", schema: "https://schema.org/InStock" };
  }
  return { text: "In stock — dispatched today", tone: "in", schema: "https://schema.org/InStock" };
}

export interface Fact {
  label: string;
  value: string;
}

/**
 * The "key facts" table. It exists for people skimming on a phone, for the
 * structured data, and for answer engines that quote a list rather than a
 * paragraph.
 */
export function productFacts(product: Product, brand = BRAND): Fact[] {
  const variant = product.variants[0];
  const facts: Fact[] = [];
  for (const [label, value] of Object.entries(product.specs ?? {})) facts.push({ label, value });
  facts.push({ label: "Brand", value: product.brand });
  if (variant) facts.push({ label: "SKU", value: variant.sku });
  facts.push({ label: "Department", value: departmentFor(product.category).label });
  facts.push({ label: "Delivery", value: deliveryLine(product, brand) });
  facts.push({ label: "Returns", value: `${product.returnPolicy.days} days, free` });
  return facts;
}

/** Same department first, then anything else, so every product page has somewhere to go. */
export function relatedProducts(product: Product, all: Product[], limit = 4): Product[] {
  const department = departmentFor(product.category).id;
  const same = all.filter((entry) => entry.id !== product.id && departmentFor(entry.category).id === department);
  const rest = all.filter((entry) => entry.id !== product.id && departmentFor(entry.category).id !== department);
  return [...same, ...rest].slice(0, limit);
}

/** On offer, because a struck-through price is the only honest urgency signal. */
export function onOffer(products: Product[]): Product[] {
  return products.filter((product) => {
    const variant = product.variants[0];
    return Boolean(variant?.compareAt && variant.compareAt.amount > variant.price.amount);
  });
}

export function savingPercent(product: Product): number | null {
  const variant = product.variants[0];
  if (!variant?.compareAt || variant.compareAt.amount <= variant.price.amount) return null;
  return Math.round((1 - variant.price.amount / variant.compareAt.amount) * 100);
}

export interface Faq {
  question: string;
  answer: string;
}

/** The questions people actually ask before a first order, answered in place. */
export function shopFaqs(brand = BRAND): Faq[] {
  return [
    {
      question: "How much is delivery, and how long does it take?",
      answer: `Standard delivery is ${format(money(brand.delivery.standard, "GBP"))} and free on orders over ${format(
        money(brand.delivery.freeOver, "GBP")
      )}. Orders placed before ${brand.delivery.cutOff} are dispatched the same working day and arrive in ${brand.delivery.standardDays[0]}–${
        brand.delivery.standardDays[1]
      } working days. Next-day delivery is ${format(money(brand.delivery.express, "GBP"))} where the item allows it.`,
    },
    {
      question: "Can I return something I do not want?",
      answer: `Yes. ${brand.returns.summary} Start a return from your order email; the label is in the box, and the refund goes back to the card you paid with, usually within three working days of the parcel arriving.`,
    },
    {
      question: "Do the prices include VAT?",
      answer: `Yes — every price shown includes UK VAT at 20%, and the price on the product page is the price you pay at checkout.`,
    },
    {
      question: "Where do the products come from?",
      answer: `They are dispatched from UK warehouses. The supplier network is listed in the repository's SUPPLIERS.md, including which feeds supply which ranges.`,
    },
    {
      question: "Is anything in stock right now?",
      answer: `Each product page shows live stock from the supplier file and the dispatch promise for that item. If something is out of stock, the page says so instead of taking an order it cannot fill.`,
    },
  ];
}

export function departmentFaqs(group: DepartmentGroup, brand = BRAND): Faq[] {
  const cheapest = [...group.products]
    .filter((product) => listPrice(product))
    .sort((a, b) => listPrice(a)!.amount - listPrice(b)!.amount)[0];
  const faqs: Faq[] = [
    {
      question: `What is in ${group.department.label.toLowerCase()}?`,
      answer: `${group.products.length} products, covering ${group.department.sections.slice(0, 4).join(", ").toLowerCase()}. ${group.department.why}`,
    },
  ];
  if (cheapest) {
    faqs.push({
      question: `How much does ${group.department.label.toLowerCase()} start at?`,
      answer: `The cheapest item is ${cheapest.title} at ${format(listPrice(cheapest)!)} including VAT. ${
        deliveryFor(listPrice(cheapest)!, brand).label
      }.`,
    });
  }
  faqs.push({
    question: `How quickly will ${group.department.label.toLowerCase()} arrive?`,
    answer: `Orders before ${brand.delivery.cutOff} are dispatched the same working day, and standard delivery takes ${
      brand.delivery.standardDays[0]
    }–${brand.delivery.standardDays[1]} working days. Delivery is free over ${format(money(brand.delivery.freeOver, "GBP"))}.`,
  });
  return faqs;
}

/** Titles are written for the query, not for the brand. */
export function titleFor(parts: { product?: string; department?: string; purpose?: string }, brand = BRAND): string {
  const tail = ` | ${brand.name}`;
  const core = parts.product
    ? `${parts.product}${parts.department ? ` — ${parts.department}` : ""}`
    : parts.department
      ? `${parts.department}${parts.purpose ? ` — ${parts.purpose}` : ""}`
      : `${brand.name} — ${brand.tagline}`;
  return `${core}${tail}`.slice(0, 65);
}

/** Under 155 characters, with a number and a reason to click. */
export function descriptionFor(parts: { product?: Product; department?: DepartmentGroup; brand?: typeof BRAND }): string {
  const brand = parts.brand ?? BRAND;
  if (parts.product) {
    const product = parts.product;
    const price = listPrice(product);
    const bit = product.specs?.Material ? ` ${product.specs.Material}.` : "";
    return `${product.title} — ${price ? format(price) : "priced in pounds"} with VAT included.${bit} Free delivery over ${format(
      money(brand.delivery.freeOver, "GBP")
    )}, ${brand.returns.days}-day returns.`.slice(0, 155);
  }
  if (parts.department) {
    return `${parts.department.department.label} at ${brand.name}: ${parts.department.products.length} products, prices in pounds including VAT, free delivery over ${format(
      money(brand.delivery.freeOver, "GBP")
    )} and ${brand.returns.days}-day returns.`.slice(0, 155);
  }
  return brand.description.slice(0, 155);
}
