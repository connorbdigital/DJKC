import { money } from "./money";
import type { Product } from "./catalog";

/** A complete product: what the framework expects from every page. */
export const hoodie = (): Product => ({
  id: "p_hoodie",
  slug: "heavyweight-hoodie",
  title: "Heavyweight organic hoodie",
  description:
    "A 400gsm organic cotton hoodie cut boxy, with a double-layer hood and ribbed cuffs that keep their shape after washing. Made in Portugal in a factory audited for living wages.",
  brand: "Northline",
  category: "Hoodies",
  currency: "GBP",
  images: [
    { url: "https://cdn.example.com/hoodie-front.jpg", alt: "Heavyweight organic hoodie in charcoal, front view on a model" },
    { url: "https://cdn.example.com/hoodie-back.jpg", alt: "Heavyweight organic hoodie in charcoal, back view" },
  ],
  variants: [
    { sku: "HOOD-CHR-S", title: "Charcoal / S", options: [{ name: "Colour", value: "Charcoal" }, { name: "Size", value: "S" }], price: money(8900), stock: 4, gtin: "5061234567890", weightGrams: 900 },
    { sku: "HOOD-CHR-M", title: "Charcoal / M", options: [{ name: "Colour", value: "Charcoal" }, { name: "Size", value: "M" }], price: money(8900), stock: 12, gtin: "5061234567890" },
    { sku: "HOOD-CHR-L", title: "Charcoal / L", options: [{ name: "Colour", value: "Charcoal" }, { name: "Size", value: "L" }], price: money(8900), stock: 0, gtin: "5061234567890" },
  ],
  returnPolicy: { days: 30, freeReturns: true, summary: "Free returns within 30 days." },
  attributes: { Material: "Organic cotton", Fit: "Boxy", Care: "Machine wash 30°" },
  rating: { value: 4.7, count: 128 },
  bestseller: true,
});

/** A deliberately thin product: the validator should name every gap. */
export const thinMug = (): Product => ({
  id: "p_mug",
  slug: "Mug",
  title: "Mug",
  description: "A mug.",
  brand: "",
  category: "Home",
  currency: "GBP",
  images: [{ url: "https://cdn.example.com/mug.jpg", alt: "" }],
  variants: [{ sku: "MUG-1", title: "One size", options: [], price: money(0), stock: -1 }],
  returnPolicy: { days: 7, freeReturns: false, summary: "7 days." },
});

export const tote = (): Product => ({
  id: "p_tote",
  slug: "canvas-tote-bag",
  title: "Canvas tote bag",
  description:
    "A 12oz canvas tote with a boxed base and long handles that fit over a shoulder, printed with water-based inks that do not crack.",
  brand: "Northline",
  category: "Bags",
  currency: "GBP",
  images: [{ url: "https://cdn.example.com/tote.jpg", alt: "Canvas tote bag in natural colour, hanging on a hook" }],
  variants: [{ sku: "TOTE-NAT", title: "Natural", options: [{ name: "Colour", value: "Natural" }], price: money(2400), stock: 30, mpn: "NL-TOTE-NAT" }],
  returnPolicy: { days: 30, freeReturns: true, summary: "Free returns within 30 days." },
  attributes: { Material: "Cotton canvas", Capacity: "14 litres" },
});
