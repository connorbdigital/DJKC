import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectProfile, importCsv, parsePrice, IMPORT_CHECKS } from "./importProducts";
import { validateProduct } from "./catalog";

const aosom = [
  "Product ID,Product Name,Product Description,RRP,Stock,Stock Status,Image URL,Brand,Category,EAN,MPN",
  'AOS-1,"Bamboo shelf, folding",A three tier shelf that folds flat. Holds 15kg per tier and needs no tools at all.,49.99,24,In stock,https://cdn.example.com/shelf.jpg,Harbour & Fen,Home > Storage,,HF-1',
  "AOS-2,Rattan basket,Three nesting baskets with washable liners and cut out handles for carrying.,34.00,0,Out of stock,https://cdn.example.com/basket.jpg,Harbour & Fen,Home,,HF-2",
].join("\n");

const shopify = [
  "Handle,Title,Body (HTML),Vendor,Type,Tags,Variant SKU,Variant Price,Variant Inventory Qty,Image Src,Image Alt Text,Variant Barcode",
  'linen-cushion,Belgian linen cushion,"<p>Stonewashed linen with a hidden zip and a soft finish.</p>",Harbour & Fen,Home,"linen,cushion",CUSH-45,22.00,64,https://cdn.example.com/cushion.jpg,Linen cushion on a chair,5061234567890',
].join("\n");

describe("price parsing", () => {
  it("reads pounds, dollars, euros and plain numbers", () => {
    expect(parsePrice("£49.99", "GBP")).toEqual({ amount: 4999, currency: "GBP" });
    expect(parsePrice("1,299.00 GBP", "GBP")).toEqual({ amount: 129900, currency: "GBP" });
    expect(parsePrice("19.99", "EUR")).toEqual({ amount: 1999, currency: "EUR" });
    expect(parsePrice("$1,050", "GBP")).toEqual({ amount: 105000, currency: "USD" });
    expect(parsePrice("1,299", "GBP")).toEqual({ amount: 129900, currency: "GBP" });
  });

  it("handles European decimal commas", () => {
    expect(parsePrice("1.299,00 €", "GBP")).toEqual({ amount: 129900, currency: "EUR" });
    expect(parsePrice("49,95", "EUR")).toEqual({ amount: 4995, currency: "EUR" });
  });

  it("refuses what it cannot read instead of guessing zero", () => {
    expect(parsePrice("", "GBP")).toBeNull();
    expect(parsePrice("call us", "GBP")).toBeNull();
    expect(parsePrice("-5", "GBP")).toBeNull();
  });
});

describe("profile detection", () => {
  it("recognises a trade feed and a Shopify export", () => {
    expect(detectProfile(["Product ID", "Product Name", "RRP", "Stock", "Image URL", "MPN"]).profile?.id).toBe("aosom");
    expect(detectProfile(["Handle", "Title", "Body (HTML)", "Variant Price", "Variant SKU", "Image Src"]).profile?.id).toBe("shopify");
  });

  it("does not force a profile when nothing matches", () => {
    const result = detectProfile(["a", "b", "c"]);
    expect(result.profile).toBeUndefined();
    expect(result.best[0]!.matched).toBeLessThan(4);
  });
});

describe("importing a feed", () => {
  it("turns trade rows into catalogue products", () => {
    const result = importCsv(aosom, { defaultBrand: "Shop", currency: "GBP" });
    expect(result.profile.id).toBe("aosom");
    expect(result.stats.rows).toBe(2);
    expect(result.stats.imported).toBe(2);
    expect(result.stats.skipped).toBe(0);

    const shelf = result.products[0]!;
    expect(shelf.title).toBe("Bamboo shelf, folding");
    expect(shelf.slug).toBe("bamboo-shelf-folding");
    expect(shelf.category).toBe("Home");
    expect(shelf.variants[0]!.price).toEqual({ amount: 4999, currency: "GBP" });
    expect(shelf.variants[0]!.stock).toBe(24);
    expect(shelf.variants[0]!.mpn).toBe("HF-1");
    expect(shelf.images[0]!.url).toBe("https://cdn.example.com/shelf.jpg");
    expect(shelf.images[0]!.alt).toContain("Bamboo shelf, folding");
    expect(result.products[1]!.variants[0]!.stock).toBe(0);
  });

  it("maps a Shopify export, including the handle and barcode", () => {
    const result = importCsv(shopify, { currency: "GBP" });
    expect(result.profile.id).toBe("shopify");
    const cushion = result.products[0]!;
    expect(cushion.slug).toBe("linen-cushion");
    expect(cushion.brand).toBe("Harbour & Fen");
    expect(cushion.variants[0]!.sku).toBe("CUSH-45");
    expect(cushion.variants[0]!.price.amount).toBe(2200);
    expect(cushion.variants[0]!.gtin).toBe("5061234567890");
    expect(cushion.description).toContain("<p>"); // stored as given; the feed strips it later
    expect(result.issues).toEqual([]);
  });

  it("skips a row it cannot price, and says which row", () => {
    const csv = ["id,title,price,stock", "1,Good shelf,9.99,4", "2,Bad shelf,ask us,4"].join("\n");
    const result = importCsv(csv);
    expect(result.stats.imported).toBe(1);
    const skipped = result.issues.filter((issue) => issue.action === "skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ row: 3, action: "skipped" });
    expect(skipped[0]!.problem).toContain("ask us");
  });

  it("skips a row with no title", () => {
    const result = importCsv("id,title,price\n1,,9.99\n");
    expect(result.products).toEqual([]);
    expect(result.issues[0]!.problem).toBe("no title");
  });

  it("repairs duplicate slugs instead of overwriting a product", () => {
    const csv = ["id,title,price\n1,Same name,10.00\n2,Same name,12.00"].join("\n");
    const result = importCsv(csv);
    expect(result.products.map((product) => product.slug)).toEqual(["same-name", "same-name-2"]);
    expect(result.issues[0]!.action).toBe("repaired");
  });

  it("flags a product it cannot identify, and one with no image", () => {
    const csv = ["id,title,price\n1,Plain thing,10.00"].join("\n");
    const result = importCsv(csv);
    const problems = result.issues.map((issue) => issue.problem).join(" | ");
    expect(problems).toContain("no GTIN or MPN");
    expect(problems).toContain("no usable image URL");
    expect(result.products[0]!.images).toEqual([]);
  });

  it("keeps a compare-at price only when it is genuinely higher", () => {
    const csv = ["id,title,price,compare at\n1,Thing,10.00,12.00\n2,Other,10.00,8.00"].join("\n");
    const result = importCsv(csv);
    expect(result.products[0]!.variants[0]!.compareAt?.amount).toBe(1200);
    expect(result.products[1]!.variants[0]!.compareAt).toBeUndefined();
  });

  it("carries the checks that apply to any supplier file", () => {
    expect(IMPORT_CHECKS.join(" ")).toMatch(/trade prices/);
    expect(IMPORT_CHECKS.join(" ")).toMatch(/stock/i);
    expect(IMPORT_CHECKS.join(" ")).toMatch(/VAT/);
  });
});

describe("the sample catalogue", () => {
  const csv = readFileSync(path.join(__dirname, "..", "catalogue", "products.csv"), "utf8");

  it("imports every row and produces valid products", () => {
    const result = importCsv(csv, { defaultBrand: "Harbour & Fen", currency: "GBP" });
    expect(result.stats.skipped).toBe(0);
    expect(result.stats.imported).toBe(12);
    expect(result.profile.id).toBe("aosom");

    const problems = result.products.flatMap((product) =>
      validateProduct({ ...product, images: [{ url: "https://cdn.example.com/x.svg", alt: "A placeholder illustration" }] })
    );
    expect(problems).toEqual([]);
  });

  it("has categories worth browsing and a mix of stock states", () => {
    const result = importCsv(csv, { defaultBrand: "Harbour & Fen" });
    expect(new Set(result.products.map((product) => product.category)).size).toBeGreaterThan(2);
    expect(result.products.some((product) => product.variants[0]!.stock === 0)).toBe(true);
    expect(result.products.every((product) => product.variants[0]!.price.amount >= 2000)).toBe(true);
  });
});
