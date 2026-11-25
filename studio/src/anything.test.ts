import { afterEach, describe, expect, it, vi } from "vitest";
import { ANYTHING_API, basicAuth, anythingTarget } from "./anything";
import handler from "../api/anything";

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
  const out = { status: 0, body: "" };
  const res = {
    set statusCode(value: number) {
      out.status = value;
    },
    get statusCode() {
      return out.status;
    },
    setHeader() {},
    end(text: string) {
      out.body = text;
    },
  };
  return { res: res as unknown as Parameters<typeof handler>[1], out };
}

const original = { canonical: process.env.ANYTHING_API_KEY, legacy: process.env.Anything_Key };
afterEach(() => {
  if (original.canonical === undefined) delete process.env.ANYTHING_API_KEY;
  else process.env.ANYTHING_API_KEY = original.canonical;
  if (original.legacy === undefined) delete process.env.Anything_Key;
  else process.env.Anything_Key = original.legacy;
  vi.unstubAllGlobals();
});

describe("the Anything proxy rules", () => {
  it("forwards the two documented reads and nothing else", () => {
    const projects = anythingTarget("/v0/api/projects?limit=100");
    expect(projects.ok).toBe(true);
    if (projects.ok) expect(projects.url).toBe(`${ANYTHING_API}/v0/api/projects?limit=100`);

    const me = anythingTarget("/v0/api/me");
    expect(me.ok).toBe(true);

    /* One project's own detail is readable; anything nested under it is not. */
    const detail = anythingTarget("/v0/api/projects/prj_9fk2");
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.url).toBe(`${ANYTHING_API}/v0/api/projects/prj_9fk2`);

    for (const path of [
      "/v0/api/projects/123/delete",
      "/v0/api/projects/123/files",
      "/v0/api/projects/",
      "/v0/api/organizations",
      "/",
      "v0/api/me",
      "https://x.test/v0/api/me",
      "/v0/api/../me",
      "",
      "/v0/api/me@x",
      "/v0/api/projects?query=<script>",
    ]) {
      expect(anythingTarget(path).ok, path).toBe(false);
    }
  });

  it("uses the key as the Basic username with an empty password", () => {
    expect(basicAuth("anything_abc")).toBe(`Basic ${btoa("anything_abc:")}`);
  });
});

describe("the Anything proxy handler", () => {
  it("says which variable is missing, and reads nothing", async () => {
    delete process.env.ANYTHING_API_KEY;
    delete process.env.Anything_Key;
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { res, out } = response();
    await handler(request({ path: "/v0/api/projects" }), res);
    expect(out.status).toBe(503);
    expect(out.body).toContain("ANYTHING_API_KEY");
    expect(spy).not.toHaveBeenCalled();
  });

  it("accepts the key under the name it was first saved as", async () => {
    delete process.env.ANYTHING_API_KEY;
    process.env.Anything_Key = "anything_from_old_name";
    let auth = "";
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).Authorization ?? "";
      return new Response(JSON.stringify({ projects: [] }), { status: 200 });
    });
    const { res, out } = response();
    await handler(request({ path: "/v0/api/projects" }), res);
    expect(out.status).toBe(200);
    expect(auth).toBe(basicAuth("anything_from_old_name"));
    expect(out.body).not.toContain("anything_from_old_name");
  });

  it("turns a rejected key into a sentence about the key", async () => {
    process.env.ANYTHING_API_KEY = "anything_bad";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const { res, out } = response();
    await handler(request({ path: "/v0/api/me" }), res);
    expect(out.status).toBe(401);
    expect(out.body).toMatch(/rejected that key/i);
  });

  it("answers a GET with its own pulse, and makes no request to do it", async () => {
    process.env.ANYTHING_API_KEY = "anything_ok";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const pulse = response();
    await handler(request({ path: "/v0/api/projects" }, "GET"), pulse.res);
    expect(pulse.out.status).toBe(200);
    const body = JSON.parse(pulse.out.body) as { bridge: string; key: string; forwards: string[] };
    expect(body.bridge).toBe("alive");
    expect(body.key).toBe("set");
    expect(body.forwards).toContain("/v0/api/projects");
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses anything but POST and GET, and any off-list path, before the network", async () => {
    process.env.ANYTHING_API_KEY = "anything_ok";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const first = response();
    await handler(request({ path: "/v0/api/projects" }, "DELETE"), first.res);
    expect(first.out.status).toBe(405);
    const second = response();
    await handler(request({ path: "/v0/api/projects/delete" }), second.res);
    expect(second.out.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
