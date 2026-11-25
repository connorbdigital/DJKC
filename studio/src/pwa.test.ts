import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Studio as something you can install and open on a train. These are the
 * checks a browser makes before it offers to install, written down here.
 */

const root = join(process.cwd(), "public");
const read = (name: string) => readFileSync(join(root, name), "utf8");

/** PNG width and height live at bytes 16–23, after the IHDR chunk header. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("the installable studio", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));

  it("has the manifest a browser insists on", () => {
    expect(manifest.name).toMatch(/Studio/);
    expect(manifest.short_name).toBe("Studio");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toMatch(/^\/#tab=/);
    expect(manifest.scope).toBe("/");
    expect(manifest.theme_color).toBe("#0A0512");
    expect(manifest.id).toBe("/");
  });

  it("ships every icon it claims, at the size it claims", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const file = join(root, icon.src.replace(/^\//, ""));
      expect(existsSync(file)).toBe(true);
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(pngSize(file)).toEqual({ width, height });
      expect(icon.type).toBe("image/png");
    }
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  });

  it("serves the manifest and the touch icon from the page", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(existsSync(join(root, "apple-touch-icon.png"))).toBe(true);
  });

  it("keeps the shell and refuses to cache an answer from /api", () => {
    const sw = read("sw.js");
    expect(sw).toContain('"/index.html"');
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toMatch(/addEventListener\("install"/);
    expect(sw).toMatch(/addEventListener\("activate"/);
    expect(sw).toMatch(/request.mode === "navigate"/);
    /* A version in the cache name is how an old shell gets replaced. */
    expect(sw).toMatch(/const CACHE = "studio-shell-v\d+"/);
  });

  it("registers the worker only in a production build", () => {
    const main = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain('serviceWorker.register("/sw.js")');
  });
});
