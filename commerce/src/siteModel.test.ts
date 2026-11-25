import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "../catalogue/site";
import { listPrice, type Product } from "./catalog";
import { money } from "./money";
import {
  OTHER_DEPARTMENT,
  countIn,
  deliveryFor,
  deliveryLine,
  departmentFaqs,
  departmentFor,
  descriptionFor,
  groupByDepartment,
  onOffer,
  productFacts,
  relatedProducts,
  savingPercent,
  shopFaqs,
  stockLabel,
  titleFor,
} from "./siteModel";

const product = (overrides: Partial<Product> & { slug: string; title: string; category: string }): Product => ({
  id: overrides.slug,
  description: "A perfectly ordinary product with enough words to be useful to a shopper reading it.",
  brand: "Hearth & Grain",
  currency: "GBP",
  images: [{ url: "assets/x.svg", alt: "A placeholder illustration of the thing" }],
  variants: [{ sku: `SKU-${overrides.slug}`, title: "Default", options: [], price: money(4999, "GBP"), stock: 9 }],
  returnPolicy: { days: 30, freeReturns: true, summary: "Free returns for 30 days." },
  ...overrides,
});

const shelf = product({ slug: "shelf", title: "Bamboo shelf", category: "Home", specs: { Material: "Bamboo", Dimensions: "60 x 28cm" } });
const mug = product({ slug: "mug", title: "Stoneware mug", category: "Kitchen" });
const planter = product({
  slug: "planter",
  title: "Glazed planter",
  category: "Garden > Planters",
  variants: [{ sku: "SKU-planter", title: "Default", options: [], price: money(2450, "GBP"), stock: 0 }],
});
const lamp = product({ slug: "lamp", title: "Desk lamp", category: "lighting" });
const cushion = product({
  slug: "cushion",
  title: "Linen cushion",
  category: "Home",
  variants: [{ sku: "SKU-cushion", title: "Default", options: [], price: money(2200, "GBP"), stock: 3, compareAt: money(2800, "GBP") }],
});
const all = [shelf, mug, planter, lamp, cushion];

describe("departments", () => {
  it("maps supplier categories onto the twelve departments", () => {
    expect(departmentFor("Home").id).toBe("home");
    expect(departmentFor("home").id).toBe("home");
    expect(departmentFor("Garden > Planters").id).toBe("garden");
    expect(departmentFor("Kitchen & Dining").id).toBe("kitchen");
    expect(departmentFor("lighting").id).toBe("lighting");
    expect(departmentFor("Storage & Organisation").id).toBe("storage");
    expect(departmentFor("Bird seed").id).toBe(OTHER_DEPARTMENT.id);
  });

  it("keeps the empty departments in the navigation, with a count of zero", () => {
    const groups = groupByDepartment(all);
    const toys = groups.find((group) => group.department.id === "toys")!;
    expect(toys.products).toEqual([]);
    expect(countIn(groups, "toys")).toBe(0);
    expect(countIn(groups, "home")).toBe(2);
  });

  it("files products that fit nowhere under a real department rather than dropping them", () => {
    const odd = product({ slug: "odd", title: "Mystery box", category: "Surprise" });
    const groups = groupByDepartment([...all, odd]);
    expect(groups.at(-1)!.department.id).toBe("other");
    expect(groups.at(-1)!.products.map((entry) => entry.slug)).toEqual(["odd"]);
  });

  it("has a why for every department, because a shelf without a reason is clutter", () => {
    for (const department of DEPARTMENTS) {
      expect(department.why.length, department.id).toBeGreaterThan(60);
      expect(department.sections.length, department.id).toBeGreaterThan(2);
    }
  });
});

describe("delivery", () => {
  it("is free over the threshold and a stated price under it", () => {
    const under = deliveryFor(money(2000, "GBP"));
    expect(under.free).toBe(false);
    expect(under.label).toBe("£3.95 delivery");
    expect(under.remaining).toBe(2000);

    const over = deliveryFor(money(4999, "GBP"));
    expect(over.free).toBe(true);
    expect(over.label).toBe("Free delivery");
    expect(over.progress).toBe(100);
  });

  it("tells the shopper on the card what it will cost before they click", () => {
    expect(deliveryLine(cushion)).toContain("+ £3.95 delivery");
    expect(deliveryLine(shelf)).toContain("Free delivery");
    expect(deliveryLine(shelf)).toContain("2–3 working days");
  });

  it("still shows a price for something that is out of stock", () => {
    expect(listPrice(planter)?.amount).toBe(2450);
    expect(deliveryLine(planter)).toContain("+ £3.95");
  });
});

describe("stock and prices", () => {
  it("describes stock honestly, including low stock", () => {
    const variant = (sku: string, stock: number) => ({ sku, title: "Default", options: [], price: money(100, "GBP"), stock });
    expect(stockLabel(variant("a", 20))).toMatchObject({ tone: "in" });
    expect(stockLabel(variant("b", 3)).text).toBe("Only 3 left");
    expect(stockLabel(variant("c", 0))).toMatchObject({ tone: "out" });
  });

  it("only calls something an offer when the old price was genuinely higher", () => {
    expect(onOffer(all).map((entry) => entry.slug)).toEqual(["cushion"]);
    expect(savingPercent(cushion)).toBe(21);
    expect(savingPercent(shelf)).toBeNull();
  });
});

describe("the product page's facts", () => {
  it("leads with the spec rows, then the things every shopper asks", () => {
    const facts = productFacts(shelf);
    expect(facts.slice(0, 2)).toEqual([
      { label: "Material", value: "Bamboo" },
      { label: "Dimensions", value: "60 x 28cm" },
    ]);
    expect(facts.map((fact) => fact.label)).toContain("Returns");
    expect(facts.find((fact) => fact.label === "Delivery")?.value).toContain("Free delivery");
    expect(facts.find((fact) => fact.label === "Department")?.value).toBe("Home & Furniture");
  });

  it("recommends its own department first", () => {
    const related = relatedProducts(shelf, all, 4);
    expect(related).toHaveLength(4);
    expect(related[0]!.category).toBe("Home");
    expect(related.some((entry) => entry.slug === "shelf")).toBe(false);
  });
});

describe("the words that get the page found", () => {
  it("writes titles for the query, inside 65 characters", () => {
    const title = titleFor({ department: "Garden & Outdoor", purpose: "free delivery over £40" });
    expect(title).toContain("Garden & Outdoor");
    expect(title).toContain("Hearth & Grain");
    expect(title.length).toBeLessThanOrEqual(65);
    expect(titleFor({}).length).toBeLessThanOrEqual(65);
  });

  it("writes descriptions with a price and a reason to click, under 155 characters", () => {
    const meta = descriptionFor({ product: shelf });
    expect(meta).toContain("£49.99");
    expect(meta.length).toBeLessThanOrEqual(155);
    const dept = descriptionFor({ department: groupByDepartment(all).find((group) => group.department.id === "home")! });
    expect(dept).toContain("Home & Furniture");
    expect(dept.length).toBeLessThanOrEqual(155);
  });

  it("answers the questions people ask before a first order", () => {
    const faqs = shopFaqs();
    expect(faqs.length).toBeGreaterThanOrEqual(5);
    const answers = faqs.map((faq) => faq.answer).join(" ");
    expect(answers).toContain("£3.95");
    expect(answers).toContain("30 days");
    expect(answers).toContain("VAT");
    expect(answers).toContain("UK warehouses");
  });

  it("gives each department its own answers, with a real starting price", () => {
    const group = groupByDepartment(all).find((entry) => entry.department.id === "home")!;
    const faqs = departmentFaqs(group);
    expect(faqs[0]!.answer).toContain("2 products");
    expect(faqs.map((faq) => faq.answer).join(" ")).toContain("£22.00");
  });
});
