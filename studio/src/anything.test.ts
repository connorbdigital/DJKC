import { afterEach, describe, expect, it, vi } from "vitest";
import { ANYTHING_API, basicAuth, anythingTarget, cleanKey, keyCandidates, keyDiagnosis } from "./anything";
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
    expect(out.body).toMatch(/rejected the stored key/i);
    expect(out.body).toContain("probe=1");
    /* The diagnosis is about the key's shape; the key itself never appears. */
    expect(out.body).toContain("ANYTHING_API_KEY is 12 characters");
    expect(out.body).toContain("ANYTHING_API_KEY is 12 characters");
    expect(out.body).not.toContain("anything_bad");
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

describe("two keys in the project, one of them wrong", () => {
  /* This is the 401 that was reported: ANYTHING_API_KEY held a value Anything
     refused, and Anything_Key held the right one. The canonical name used to win
     silently, so the bridge reported a rejected key while a good one sat next to
     it unused. */

  it("finds the key whatever case and punctuation its name was given", () => {
    /* Vercel is case-sensitive, and anything_api_key is what a person types. */
    for (const name of ["ANYTHING_API_KEY", "Anything_Key", "anything_api_key", "anything-key", "AnythingAPIKey"]) {
      expect(keyCandidates({ [name]: "anything_abc" })).toEqual([{ name, value: "anything_abc" }]);
    }
    expect(keyCandidates({ PATH: "/bin", GITHUB_TOKEN: "ghp_x" })).toEqual([]);
  });

  it("trims what a dashboard pastes, and takes one layer of quotes off", () => {
    expect(cleanKey("  anything_abc\n")).toBe("anything_abc");
    expect(cleanKey('"anything_abc"')).toBe("anything_abc");
    expect(cleanKey("'anything_abc'")).toBe("anything_abc");
    expect(cleanKey("anything_abc")).toBe("anything_abc");
    /* The two shapes that look right and 401: the docs' trailing colon, and a
       key wrapped across two lines by the terminal it was copied from. */
    expect(cleanKey("anything_abc:")).toBe("anything_abc");
    expect(cleanKey("anything_ab\nc_def")).toBe("anything_abc_def");
    expect(keyCandidates({ ANYTHING_API_KEY: " anything_a ", Anything_Key: "anything_a" })).toEqual([
      { name: "ANYTHING_API_KEY", value: "anything_a" },
    ]);
  });

  it("falls through to the second stored key when the first is refused", async () => {
    process.env.ANYTHING_API_KEY = "anything_wrong";
    process.env.Anything_Key = "anything_right";
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization ?? "";
      seen.push(auth);
      return auth === basicAuth("anything_right")
        ? new Response(JSON.stringify({ projects: [] }), { status: 200 })
        : new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    });
    const { res, out } = response();
    await handler(request({ path: "/v0/api/projects" }), res);
    expect(out.status).toBe(200);
    expect(seen).toContain(basicAuth("anything_right"));
    expect(out.body).not.toContain("anything_right");
    expect(out.body).not.toContain("anything_wrong");
  });

  it("names both keys, with their shapes, when both are refused", async () => {
    process.env.ANYTHING_API_KEY = "  sk_live_wrong_token  ";
    process.env.Anything_Key = "anything_also_wrong";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const { res, out } = response();
    await handler(request({ path: "/v0/api/me" }), res);
    expect(out.status).toBe(401);
    expect(out.body).toContain("ANYTHING_API_KEY");
    expect(out.body).toContain("Anything_Key");
    expect(out.body).toContain("space or newline");
    expect(out.body).toContain("probe=1");
    expect(out.body).not.toContain("sk_live_wrong_token");
  });

  it("answers ?probe=1 with what each stored key is and what it answers", async () => {
    process.env.ANYTHING_API_KEY = "anything_wrong";
    process.env.Anything_Key = "anything_right";
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization ?? "";
      return auth === basicAuth("anything_right")
        ? new Response(JSON.stringify({ id: "u1", email: "hello@example.co.uk", organizations: [] }), { status: 200 })
        : new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    });
    const { res, out } = response();
    const probe = { method: "GET", url: "/api/anything?probe=1" } as unknown as Parameters<typeof handler>[0];
    await handler(probe, res);
    const body = JSON.parse(out.body) as {
      ok: boolean;
      key: string;
      probe: { working: string | null; verdict: string; keys: { name: string; accepted: boolean; status: number }[] };
    };
    expect(out.status).toBe(200);
    expect(body.key).toBe("set");
    expect(body.probe.working).toBe("Anything_Key");
    expect(body.probe.keys.map((entry) => [entry.name, entry.status])).toEqual([
      ["ANYTHING_API_KEY", 401],
      ["Anything_Key", 200],
    ]);
    expect(body.probe.verdict).toContain("Anything_Key is accepted");
    expect(out.body).not.toContain("anything_right");
  });

  it("says the truth in a probe when nothing is set, without calling Anything", async () => {
    delete process.env.ANYTHING_API_KEY;
    delete process.env.Anything_Key;
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const { res, out } = response();
    await handler({ method: "GET", url: "/api/anything?probe=1" } as unknown as Parameters<typeof handler>[0], res);
    const body = JSON.parse(out.body) as { key: string; probe: { verdict: string } };
    expect(body.key).toBe("missing");
    expect(body.probe.verdict).toContain("ANYTHING_API_KEY");
    expect(spy).not.toHaveBeenCalled();
  });

  it("describes a key without ever printing it", () => {
    const diagnosis = keyDiagnosis("Anything_Key", '"eyJhbGciOi.payload.signature-padded-out-to-be-long-enough-to-look-like-a-jwt-0000000000"');
    expect(diagnosis).toContain("Anything_Key");
    expect(diagnosis).toContain("quotes");
    expect(diagnosis).toContain("signed token");
    expect(diagnosis).not.toContain("eyJhbGci");
  });
});

describe("the probe says why a key is refused", () => {
  const probeReport = async () => {
    const { res, out } = response();
    await handler({ method: "GET", url: "/api/anything?probe=1" } as unknown as Parameters<typeof handler>[0], res);
    return JSON.parse(out.body) as {
      probe: { working: string | null; verdict: string; keys: { name: string; length: number; looksLikeExample: boolean; accepted: boolean }[] };
    };
  };

  it("names the docs' own example when that is what was stored", async () => {
    process.env.Anything_Key = "anything_xxx:";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const body = await probeReport();
    expect(body.probe.working).toBeNull();
    expect(body.probe.keys[0]!.length).toBe(12);
    expect(body.probe.keys[0]!.looksLikeExample).toBe(true);
    expect(body.probe.verdict).toMatch(/example printed in Anything's documentation/i);
    expect(body.probe.verdict).toMatch(/Settings → API Keys → Create key/);
    expect(body.probe.verdict).not.toContain("anything_xxx");
  });

  it("says a right-shaped key is dead rather than blaming the paste", async () => {
    process.env.Anything_Key = "anything_9f2c4d6e8a0b1c3d5e7f9a1b3c5d7e9f";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const body = await probeReport();
    expect(body.probe.verdict).toMatch(/dead or from another account/i);
    expect(body.probe.verdict).not.toMatch(/example printed/i);
  });
});

describe("the scheme anything actually wants", () => {
  it("reports every header it tried, so the answer is which one works", async () => {
    process.env.Anything_Key = "anything_9f2c4d6e8a0b1c3d5e7f9a1b3c5d7e9f";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const { res, out } = response();
    await handler({ method: "GET", url: "/api/anything?probe=1" } as unknown as Parameters<typeof handler>[0], res);
    const body = JSON.parse(out.body) as {
      probe: { keys: { tried: { scheme: string; status: number }[]; scheme: string | null; accepted: boolean }[] };
    };
    expect(body.probe.keys[0]!.tried.map((entry) => entry.scheme)).toEqual(["basic", "bearer", "x-api-key"]);
    expect(body.probe.keys[0]!.scheme).toBeNull();
    expect(body.probe.keys[0]!.accepted).toBe(false);
  });

  it("switches to bearer when that is what Anything accepts, and remembers it", async () => {
    process.env.Anything_Key = "anything_9f2c4d6e8a0b1c3d5e7f9a1b3c5d7e9f";
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      seen.push(headers.Authorization ?? headers["X-API-Key"] ?? "");
      return (headers.Authorization ?? "").startsWith("Bearer ")
        ? new Response(JSON.stringify({ projects: [] }), { status: 200 })
        : new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    });
    const { res, out } = response();
    await handler(request({ path: "/v0/api/projects" }), res);
    expect(out.status).toBe(200);
    expect(seen.some((header) => header.startsWith("Bearer anything_"))).toBe(true);
    expect(out.body).not.toContain("anything_9f2c");
  });
});
