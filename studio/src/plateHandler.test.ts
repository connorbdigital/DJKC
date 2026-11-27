import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/site";

/**
 * The plate endpoint: what a page looks like, and its own picture as bytes.
 *
 * The interesting assertions are the small ones — that the picture is rewritten
 * to this same endpoint (a cross-origin image taints the canvas), that a page
 * with no colours still makes a plate, and that anything which is not an image
 * is refused rather than drawn.
 */

function request(url: string) {
  return { method: "GET", url } as unknown as Parameters<typeof handler>[0];
}

function response() {
  const out: { status: number; text: string; raw: Buffer; headers: Record<string, string> } = {
    status: 0,
    text: "",
    raw: Buffer.alloc(0),
    headers: {},
  };
  const res = {
    set statusCode(value: number) {
      out.status = value;
    },
    get statusCode() {
      return out.status;
    },
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
    },
    end(body: string | Buffer) {
      if (Buffer.isBuffer(body)) out.raw = body;
      else out.text = body;
    },
  };
  return { res: res as unknown as Parameters<typeof handler>[1], out };
}

const PAGE = `<!doctype html><html><head>
<title>Bamboo folding shelf rack — Hearth &amp; Grain</title>
<meta property="og:title" content="Bamboo folding shelf rack">
<meta property="og:description" content="Three tiers, folds flat in seconds.">
<meta property="og:image" content="/assets/bamboo.svg">
<meta name="theme-color" content="#f7efe2">
<style>:root{--ink:#180f1f}</style>
</head><body><h1>Bamboo folding shelf rack</h1></body></html>`;

const pageResponse = (body = PAGE, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

afterEach(() => vi.unstubAllGlobals());

describe("the plate endpoint", () => {
  it("reads one page and returns what a plate is made of", async () => {
    vi.stubGlobal("fetch", async () => pageResponse());
    const { res, out } = response();
    await handler(request("/api/site?plate=https://ecommerce-two-psi-13.vercel.app/product/bamboo.html"), res);

    expect(out.status).toBe(200);
    expect(out.headers["cache-control"]).toContain("s-maxage");
    const body = JSON.parse(out.text);
    expect(body.ok).toBe(true);
    expect(body.plate.title).toBe("Bamboo folding shelf rack");
    expect(body.plate.h1).toBe("Bamboo folding shelf rack");
    expect(body.plate.palette).toEqual(["#f7efe2", "#180f1f"]);
    /* The picture must come back through this endpoint, or the canvas refuses it. */
    expect(body.plate.image).toBe("/api/site?image=https%3A%2F%2Fecommerce-two-psi-13.vercel.app%2Fassets%2Fbamboo.svg");
  });

  it("still makes a plate for a page with no picture and no colours", async () => {
    vi.stubGlobal("fetch", async () => pageResponse("<html><head><title>Plain</title></head><body></body></html>"));
    const { res, out } = response();
    await handler(request("/api/site?plate=https://kaysie.sitebuildup.co.uk/"), res);
    const body = JSON.parse(out.text);
    expect(body.plate.image).toBeNull();
    expect(body.plate.palette).toEqual([]);
    expect(body.plate.title).toBe("Plain");
  });

  it("refuses an address the guard will not read", async () => {
    const called = vi.fn();
    vi.stubGlobal("fetch", called);
    const { res, out } = response();
    await handler(request("/api/site?plate=http://localhost:3000/"), res);
    expect(out.status).toBe(400);
    expect(JSON.parse(out.text).ok).toBe(false);
    expect(called).not.toHaveBeenCalled();
  });

  it("passes on the page's own refusal", async () => {
    vi.stubGlobal("fetch", async () => new Response("gone", { status: 404, headers: { "content-type": "text/html" } }));
    const { res, out } = response();
    await handler(request("/api/site?plate=https://ecommerce-two-psi-13.vercel.app/missing.html"), res);
    expect(out.status).toBe(400);
    expect(JSON.parse(out.text).error).toMatch(/404/);
  });
});

describe("the image endpoint", () => {
  it("returns the bytes, with the page's own content type", async () => {
    const bytes = Buffer.from("89504e470d0a1a0a", "hex");
    vi.stubGlobal("fetch", async () => new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }));
    const { res, out } = response();
    await handler(request("/api/site?image=https://ecommerce-two-psi-13.vercel.app/assets/one.png"), res);
    expect(out.status).toBe(200);
    expect(out.headers["content-type"]).toBe("image/png");
    expect(out.headers["cache-control"]).toContain("max-age=86400");
    expect(out.raw.equals(bytes)).toBe(true);
  });

  it("refuses anything that is not an image", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    const { res, out } = response();
    await handler(request("/api/site?image=https://ecommerce-two-psi-13.vercel.app/index.html"), res);
    expect(out.status).toBe(415);
    expect(JSON.parse(out.text).error).toMatch(/is text\/html/);
  });

  it("refuses a picture too large to draw", async () => {
    const huge = Buffer.alloc(3_000_000);
    vi.stubGlobal(
      "fetch",
      async () => new Response(huge, { status: 200, headers: { "content-type": "image/jpeg" } })
    );
    const { res, out } = response();
    await handler(request("/api/site?image=https://ecommerce-two-psi-13.vercel.app/assets/huge.jpg"), res);
    expect(out.status).toBe(413);
  });
});
