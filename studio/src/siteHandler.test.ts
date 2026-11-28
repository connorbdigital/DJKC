import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/site";

/** A stand-in for the bits of IncomingMessage/ServerResponse the handler touches. */
function request(url: string, payload?: unknown, method = "GET", headers: Record<string, string> = {}) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  } as unknown as Parameters<typeof handler>[0];
}

function response() {
  const out = { status: 0, body: "", headers: {} as Record<string, string> };
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
    end(text: string) {
      out.body = text;
    },
  };
  return { res: res as unknown as Parameters<typeof handler>[1], out };
}

const page = `<!doctype html><html><head><title>KC — wedding DJ</title>
<meta property="og:title" content="KC — a wedding DJ in Leeds">
<meta property="og:description" content="Eleven years and 300 weddings.">
<meta property="og:image" content="/img/kc.jpg">
</head><body><h1>KC</h1></body></html>`;

const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

afterEach(() => vi.unstubAllGlobals());

describe("the page-preview handler", () => {
  it("returns the card a link makes", async () => {
    vi.stubGlobal("fetch", async () => html(page));
    const { res, out } = response();
    await handler(request("/api/site?thumb=https://kaysie.sitebuildup.co.uk/"), res);
    expect(out.status).toBe(200);
    expect(out.headers["cache-control"]).toContain("max-age");
    const body = JSON.parse(out.body);
    expect(body.ok).toBe(true);
    expect(body.preview).toEqual({
      image: "https://kaysie.sitebuildup.co.uk/img/kc.jpg",
      title: "KC — a wedding DJ in Leeds",
      description: "Eleven years and 300 weddings.",
    });
  });

  it("refuses what the guard refuses, without fetching", async () => {
    const called = vi.fn();
    vi.stubGlobal("fetch", called);
    for (const thumb of ["http://example.com/", "https://127.0.0.1/", "https://localhost/", ""]) {
      const { res, out } = response();
      await handler(request(`/api/site?thumb=${encodeURIComponent(thumb)}`), res);
      expect(out.status).toBe(400);
      expect(JSON.parse(out.body).ok).toBe(false);
    }
    expect(called).not.toHaveBeenCalled();
  });

  it("says a page cannot be read rather than inventing a card", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    const { res, out } = response();
    await handler(request("/api/site?thumb=https://kaysie.sitebuildup.co.uk/"), res);
    expect(out.status).toBe(400);
    expect(out.body).toContain("answered 500");
  });

  it("does not follow a redirect off the address that was checked", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 301, headers: { location: "https://elsewhere.example/" } }));
    const { res, out } = response();
    await handler(request("/api/site?thumb=https://kaysie.sitebuildup.co.uk/"), res);
    expect(out.status).toBe(400);
    expect(out.body).toContain("redirects");
  });

  it("audits a page on POST and keeps the old shape", async () => {
    vi.stubGlobal("fetch", async () => html(page));
    const { res, out } = response();
    await handler(request("/api/site", { url: "https://kaysie.sitebuildup.co.uk/" }, "POST"), res);
    expect(out.status).toBe(200);
    const body = JSON.parse(out.body);
    expect(body.ok).toBe(true);
    expect(body.report.title).toBe("KC — wedding DJ");
    expect(body.report.truncated).toBe(false);
  });

  it("tells you which method it wants", async () => {
    const { res, out } = response();
    await handler(request("/api/site", undefined, "DELETE"), res);
    expect(out.status).toBe(405);
    expect(out.body).toContain("?thumb=");
  });
});


describe("the audit's rate limit", () => {
  it("refuses the twenty-first audit in a minute from one address, and says when to return", async () => {
    const fetch = vi.fn(async () => html(page));
    vi.stubGlobal("fetch", fetch);
    const headers = { "x-forwarded-for": "203.0.113.44" };
    const payload = { url: "https://kaysie.sitebuildup.co.uk/" };

    for (let i = 0; i < 20; i++) {
      const { res, out } = response();
      await handler(request("/api/site", payload, "POST", headers), res);
      expect(out.status).toBe(200);
    }

    const { res, out } = response();
    await handler(request("/api/site", payload, "POST", headers), res);
    expect(out.status).toBe(429);
    expect(out.body).toContain("21 audits in a minute");
    expect(Number(out.headers["retry-after"])).toBeGreaterThan(0);

    /* A refused audit does not fetch anything: the limit is before the work. */
    expect(fetch).toHaveBeenCalledTimes(20);

    /* Another address still works, so the limit is per visitor and not per site. */
    const other = response();
    await handler(request("/api/site", payload, "POST", { "x-forwarded-for": "203.0.113.45" }), other.res);
    expect(other.out.status).toBe(200);
  });
});
