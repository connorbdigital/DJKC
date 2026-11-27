import { describe, expect, it } from "vitest";
import { accountCategories, categoriseApp, categoryOrder, classifyPart } from "./anythingCategories";

describe("reading an Anything project", () => {
  it("puts a booking screen on the bookings shelf", () => {
    expect(classifyPart("Booking form").category).toBe("bookings");
    expect(classifyPart("Appointment scheduler").category).toBe("bookings");
    expect(classifyPart("Prices").category).toBe("store");
    expect(classifyPart("Checkout").category).toBe("store");
    expect(classifyPart("Admin dashboard").category).toBe("operations");
    expect(classifyPart("Blog post").category).toBe("search");
    expect(classifyPart("About").category).toBe("marketing");
    expect(classifyPart("Theme").category).toBe("design");
    expect(classifyPart("Database").category).toBe("storage");
  });

  it("reads camelCase, kebab-case and paths", () => {
    expect(classifyPart("bookingForm").category).toBe("bookings");
    expect(classifyPart("booking-form").category).toBe("bookings");
    expect(classifyPart("Screen", "/app/admin/users").category).toBe("operations");
  });

  it("does not fall for a word inside another word", () => {
    /* "photoshop" is not a shop; "notebook" is not a booking. */
    expect(classifyPart("Photoshop export").category).toBe("storage");
    expect(classifyPart("Notebook").category).toBe("marketing");
  });

  it("says when it did not recognise a part rather than guessing loudly", () => {
    const reading = classifyPart("Home");
    expect(reading.because).toBeTruthy();
    expect(reading.category).toBe("marketing");
    const unknown = classifyPart("Zzz");
    expect(unknown.weight).toBe(0);
  });
});

describe("a whole app", () => {
  const app = categoriseApp(["Home", "Prices", "Booking form", "Booking form", "Checkout", "Gallery", "Reviews", "FAQ"]);

  it("counts every part once, on one shelf", () => {
    expect(app.counts.bookings).toBe(1);
    expect(app.counts.store).toBe(2);
    expect(app.counts.marketing).toBe(3);
    expect(app.counts.search).toBe(1);
  });

  it("names the shelf the app leans on", () => {
    expect(app.dominant).toBe("marketing");
  });
});

describe("the whole account", () => {
  const reading = accountCategories([
    { id: "a", name: "DJ site", modules: ["Home", "Booking form", "Checkout", "Prices"] },
    { id: "b", name: "Shop", modules: ["Products", "Cart", "Checkout", "Shipping"] },
  ]);

  it("totals the parts and the shelves", () => {
    expect(reading.total).toBe(8);
    expect(reading.counts.store).toBe(6);
    expect(reading.counts.bookings).toBe(1);
    expect(reading.projects).toHaveLength(2);
  });

  it("reports a dominant shelf per project", () => {
    expect(reading.projects[0].dominant).toBe("store");
    expect(reading.projects[1].dominant).toBe("store");
  });

  it("keeps the shelves in library order", () => {
    expect(categoryOrder).toEqual(["bookings", "operations", "marketing", "store", "design", "search", "storage"]);
  });
});
