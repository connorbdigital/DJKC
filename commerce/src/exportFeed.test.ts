import { describe, expect, it } from "vitest";
import { googleFeed, productsJson, sitemap, GOOGLE_HEADERS } from "./exportFeed";
import { parseCsv } from "./csv";
import { importCsv } from "./importProducts";
import { validateProduct } from "./catalog";

const csv = [
  "Product ID,Product Name,Product Description,RRP,Stock,Stock Status,Image URL,Brand,Category,EAN,MPN",
  'AOS-1,Bamboo shelf,"A three tier bamboo shelf that folds flat, holds 15kg per tier and needs no tools.",49.99,24,In stock,https://cdn.example.com/shelf.jpg,Harbour & Fen,Home,5061234567890,HF-1',
  "AOS-2,Rattan basket,\"Three nesting baskets with washable cotton liners and cut out handles, sized 30cm, 25cm and 20cm wide.\",34.00,0,Out of stock,https://cdn.example.com/basket.jpg,Harbour & Fen,Home,,HF-2",
].join("\n");

const products = importCsv(csv, { defaultBrand: "Harbour & Fen" }).products;

describe("Google Merchant feed", () => {
  const feed = googleFeed(products, { linkBase: "https://shop.example/", shipping: "GB::Free delivery:0.00 GBP" });

  it("writes one row per product with the required columns", () => {
    const table = parseCsv(feed.csv);
    expect(table.headers).toEqual([...GOOGLE_HEADERS]);
    expect(table.rows).toHaveLength(2);
    for (const header of ["id", "title", "description", "link", "image_link", "availability", "price", "brand", "condition"]) {
      expect(table.rows[0]![header]).toBeTruthy();
    }
  });

  it("formats price and availability the way Google validates them", () => {
    const table = parseCsv(feed.csv);
    expect(table.rows[0]!.price).toBe("49.99 GBP");
    expect(table.rows[0]!.availability).toBe("in_stock");
    expect(table.rows[1]!.availability).toBe("out_of_stock");
    expect(table.rows[0]!.condition).toBe("new");
    expect(table.rows[0]!.link).toBe("https://shop.example/product/bamboo-shelf.html");
  });

  it("strips markup from the description and keeps it under the cap", () => {
    const marked = importCsv(
      'Handle,Title,Body (HTML),Variant Price,Image Src\nthing,Thing,"<p>Hello <strong>there</strong> shopper, this is a description long enough to survive a feed.</p>",9.99,https://cdn.example.com/t.jpg'
    ).products;
    const row = parseCsv(googleFeed(marked, { linkBase: "https://shop.example" }).csv).rows[0]!;
    expect(row.description).not.toContain("<p>");
    expect(row.description).toBe("Hello there shopper, this is a description long enough to survive a feed.");
    expect(row.title.length).toBeLessThanOrEqual(150);
    expect(row.description.length).toBeLessThanOrEqual(5000);
  });

  it("rejects a product Google would reject, with the reason", () => {
    const noImage = importCsv("id,title,price,description\n1,Thing,9.99,A perfectly ordinary description of a thing, long enough to pass validation checks.").products;
    const result = googleFeed(noImage, { linkBase: "https://shop.example" });
    expect(result.rows).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("image");
  });

  it("keeps the identifier fields it was given", () => {
    const row = parseCsv(feed.csv).rows[0]!;
    expect(row.gtin).toBe("5061234567890");
    expect(row.mpn).toBe("HF-1");
    expect(row.brand).toBe("Harbour & Fen");
  });
});

describe("products.json and sitemap", () => {
  it("is data a front end or an app can read", () => {
    const data = JSON.parse(productsJson(products, "https://shop.example"));
    expect(data.currency).toBe("GBP");
    expect(data.products[0]).toMatchObject({
      title: "Bamboo shelf",
      slug: "bamboo-shelf",
      price: "49.99",
      currency: "GBP",
      availability: "in_stock",
      url: "https://shop.example/product/bamboo-shelf.html",
      returnDays: 30,
    });
    expect(data.products[1].availability).toBe("out_of_stock");
  });

  it("lists every page once", () => {
    const xml = sitemap(["https://shop.example/", "https://shop.example/product/bamboo-shelf.html"]);
    expect(xml.match(/<loc>/g)).toHaveLength(2);
    expect(xml.startsWith("<?xml")).toBe(true);
  });
});

describe("the imported rows stay valid products", () => {
  it("passes the framework's own validation", () => {
    expect(products.flatMap((product) => validateProduct(product))).toEqual([]);
  });
});
