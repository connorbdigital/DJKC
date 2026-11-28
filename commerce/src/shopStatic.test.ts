import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The two files a static shop cannot do without and a framework will not write
 * for it: a 404, and a manifest.
 *
 * This is a test of the *build*, not of a function — it runs the real script and
 * reads what it produced, because the failure being guarded against is one that
 * only exists in the output: a 404 whose department links point at pages that
 * were never written.
 */

const run = promisify(execFile);
const root = path.resolve(__dirname, "..");
const out = path.join(root, "catalogue", "dist");
const read = (file: string) => readFileSync(path.join(out, file), "utf8");

beforeAll(async () => {
  /* Through tsx, because the script imports its siblings without extensions and
     plain node's type stripping will not resolve those. */
  await run(path.join(root, "node_modules", ".bin", "tsx"), ["catalogue/scripts/build-site.mts"], {
    cwd: root,
    timeout: 120_000,
  });
}, 130_000);

describe("the built shop", () => {
  it("ships a manifest that a phone can install", () => {
    const manifest = JSON.parse(read("manifest.webmanifest")) as {
      name: string;
      start_url: string;
      theme_color: string;
      icons: { src: string; type: string }[];
    };
    expect(manifest.name).toBe("Hearth & Grain");
    expect(manifest.start_url).toBe("/index.html");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.icons[0]?.type).toBe("image/svg+xml");
    /* The icon the manifest names has to be there, or the install fails silently. */
    const icon = path.join(out, manifest.icons[0]!.src.replace(/^\//, ""));
    expect(existsSync(icon)).toBe(true);
    expect(statSync(icon).size).toBeGreaterThan(100);
  });

  it("links the manifest and an icon from every page's head", () => {
    for (const page of ["index.html", "shop.html", "404.html", path.join("pages", "contact.html")]) {
      const html = read(page);
      expect(html).toContain('rel="manifest"');
      expect(html).toContain('rel="icon"');
    }
  });

  it("has a 404 that is a page, is not indexed, and searches the shop", () => {
    const html = read("404.html");
    expect(html).toContain("<title>Page not found");
    expect(html).toContain('name="robots" content="noindex,follow"');
    expect(html).toContain('action="search.html"');
    expect(html).toContain("404 — page not found");
  });

  it("has a 404 whose own links all resolve — the page for broken links cannot be broken", () => {
    const html = read("404.html");
    const links = [...html.matchAll(/href="([^"#?]+)"/g)]
      .map((match) => match[1]!)
      /* Skip the inline script's own template fragments: this is a link check, not a JS parser. */
      .filter((href) => !/^[a-z]+:/i.test(href) && !href.startsWith("//") && !/['`+$<>]/.test(href));
    expect(links.length).toBeGreaterThan(5);
    for (const href of links) {
      const target = path.join(out, href);
      expect(existsSync(target), `404.html links to ${href}, which the build did not write`).toBe(true);
    }
  });
});
