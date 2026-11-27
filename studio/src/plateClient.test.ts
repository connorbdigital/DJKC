import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetPlates, isPlate, knownPlate, loadPlate, type Plate } from "./plateClient";

const PLATE: Plate = {
  url: "https://kaysie.sitebuildup.co.uk/prices.html",
  title: "Prices — KC",
  h1: "What a night costs",
  description: "Clubs from £650. Weddings from £1,100.",
  palette: ["#12040f", "#ff2bd6"],
  image: "/api/site?image=https%3A%2F%2Fkaysie.sitebuildup.co.uk%2Fog.jpg",
};

const ok = (plate: unknown) => new Response(JSON.stringify({ ok: true, plate }), { status: 200 });

beforeEach(() => forgetPlates());
afterEach(() => {
  vi.unstubAllGlobals();
  forgetPlates();
});

describe("the plate client", () => {
  it("loads a plate once and hands the same one to everyone who asks", async () => {
    const fetchMock = vi.fn(async () => ok(PLATE));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([loadPlate(PLATE.url), loadPlate(PLATE.url)]);
    const third = await loadPlate(PLATE.url);

    expect(first).toEqual(PLATE);
    expect(second).toEqual(PLATE);
    expect(third).toEqual(PLATE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(knownPlate(PLATE.url)).toEqual(PLATE);
  });

  it("asks the endpoint with the page's address, escaped", async () => {
    const fetchMock = vi.fn(async () => ok(PLATE));
    vi.stubGlobal("fetch", fetchMock);
    await loadPlate("https://ecommerce-two-psi-13.vercel.app/shop.html?a=1");
    const call = fetchMock.mock.calls[0] as unknown as [string, ...unknown[]];
    expect(call[0]).toBe(
      "/api/site?plate=https%3A%2F%2Fecommerce-two-psi-13.vercel.app%2Fshop.html%3Fa%3D1"
    );
  });

  it("treats a failure as an absence, never as an error", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    expect(await loadPlate(PLATE.url)).toBeNull();

    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    expect(await loadPlate("https://kaysie.sitebuildup.co.uk/faq.html")).toBeNull();
  });

  it("will not accept a plate-shaped object that is not one", async () => {
    vi.stubGlobal("fetch", async () => ok({ ...PLATE, palette: ["pink"] }));
    expect(await loadPlate(PLATE.url)).toBeNull();
    expect(isPlate({ ...PLATE, h1: 42 })).toBe(false);
    expect(isPlate(PLATE)).toBe(true);
  });
});
