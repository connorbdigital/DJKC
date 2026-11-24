import { describe, expect, it } from "vitest";
import { normaliseHeader, parseCsv, stringifyCsv, valueFor } from "./csv";

describe("CSV parsing", () => {
  it("reads quoted fields containing commas, quotes and newlines", () => {
    const table = parseCsv('id,title,description\r\n1,"Shelf, bamboo","He said ""hello""\r\nthen left"\r\n');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.title).toBe("Shelf, bamboo");
    expect(table.rows[0]!.description).toBe('He said "hello"\r\nthen left');
  });

  it("strips a byte-order mark and ignores blank lines", () => {
    const table = parseCsv("\uFEFFid,title\n1,Shelf\n\n2,Mug\n");
    expect(table.headers).toEqual(["id", "title"]);
    expect(table.rows.map((row) => row.title)).toEqual(["Shelf", "Mug"]);
  });

  it("pads ragged rows instead of shifting columns", () => {
    const table = parseCsv("id,title,price\n1,Shelf\n2,Mug,9.00,extra\n");
    expect(table.ragged).toBe(2);
    expect(table.rows[0]!.price).toBe("");
    expect(table.rows[1]!.title).toBe("Mug");
  });

  it("names an empty header rather than dropping the column", () => {
    expect(parseCsv("id,,title\n1,x,Shelf\n").headers).toEqual(["id", "column_2", "title"]);
  });

  it("escapes on the way out and round-trips", () => {
    const csv = stringifyCsv(["id", "title"], [["1", 'Shelf, "bamboo"'], ["2", "Line\nbreak"]]);
    expect(csv).toContain('"Shelf, ""bamboo"""');
    const back = parseCsv(csv);
    expect(back.rows[0]!.title).toBe('Shelf, "bamboo"');
    expect(back.rows[1]!.title).toBe("Line\nbreak");
  });

  it("finds a column regardless of how it is written", () => {
    const row = { "Product ID": "A1", "image_link": "https://x/y.jpg" };
    expect(valueFor(row, ["product id"])).toBe("A1");
    expect(valueFor(row, ["image link"])).toBe("https://x/y.jpg");
    expect(normaliseHeader(" Variant Price (£) ")).toBe("variantprice");
    expect(valueFor(row, ["missing"])).toBe("");
  });
});
