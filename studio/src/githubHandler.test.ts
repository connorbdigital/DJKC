import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/github";

/** A stand-in for the bits of IncomingMessage/ServerResponse the handler touches. */
function request(payload: unknown, method = "POST") {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    method,
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

const originalToken = process.env.GITHUB_TOKEN;
afterEach(() => {
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
  vi.unstubAllGlobals();
});

describe("the GitHub proxy handler", () => {
  it("says so, plainly, when no token is set", async () => {
    delete process.env.GITHUB_TOKEN;
    const { res, out } = response();
    await handler(request({ path: "/user" }), res);
    expect(out.status).toBe(503);
    expect(out.body).toContain("GITHUB_TOKEN");
  });

  it("forwards an allowed read with the token on the upstream request only", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret_value";
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push(url);
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer ghp_secret_value");
      return new Response(JSON.stringify({ login: "connorbdigital" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const { res, out } = response();
    await handler(request({ path: "/user" }), res);
    expect(seen).toEqual(["https://api.github.com/user"]);
    expect(out.status).toBe(200);
    expect(out.body).toContain("connorbdigital");
    /* The token must never travel back to the browser. */
    expect(out.body).not.toContain("ghp_secret_value");
  });

  it("refuses writes, and refuses them before touching the network", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret_value";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { res, out } = response();
    await handler(request({ path: "/repos/a/b/contents/x", method: "PUT" }), res);
    expect(out.status).toBe(403);
    expect(out.body).toMatch(/read-only/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a path outside the allowlist, and a non-POST", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret_value";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const first = response();
    await handler(request({ path: "/orgs/x/members" }), first.res);
    expect(first.out.status).toBe(400);
    const second = response();
    await handler(request({ path: "/user" }, "GET"), second.res);
    expect(second.out.status).toBe(405);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes an upstream 404 through instead of flattening it", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret_value";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
    const { res, out } = response();
    await handler(request({ path: "/repos/a/b" }), res);
    expect(out.status).toBe(404);
    expect(out.body).toContain("Not Found");
  });
});
