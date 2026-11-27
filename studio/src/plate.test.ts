import { describe, expect, it } from "vitest";
import {
  codePlateLayout,
  decodeText,
  imageFrom,
  lightness,
  normaliseHex,
  pageFacts,
  paletteFrom,
  PLATE,
  plateLayout,
  wrapText,
} from "./plate";

const PAGE = `<!doctype html>
<html><head>
  <title>Bamboo folding shelf rack — Hearth &amp; Grain</title>
  <meta name="description" content="Three tiers, folds flat in seconds." />
  <meta property="og:image" content="/assets/bamboo.svg" />
  <meta name="theme-color" content="#f7efe2" />
  <style>
    :root { --paper: #f7efe2; --ink: #180f1f; --accent: #b8452f; --accent: #b8452f; --soft: #e7d8c3; }
    .x { color: notacolour; }
  </style>
</head>
<body><h1 class="title">Bamboo <em>folding</em> shelf rack</h1></body></html>`;

describe("colours", () => {
  it("normalises short, long and alpha hexes, and refuses everything else", () => {
    expect(normaliseHex("#abc")).toBe("#aabbcc");
    expect(normaliseHex("#AABBCC")).toBe("#aabbcc");
    expect(normaliseHex("#aabbccdd")).toBe("#aabbcc");
    expect(normaliseHex("red")).toBeNull();
    expect(normaliseHex("#ab")).toBeNull();
    expect(normaliseHex("#gggggg")).toBeNull();
  });

  it("puts the theme colour first, then the page's own variables in order, once each", () => {
    expect(paletteFrom(PAGE)).toEqual(["#f7efe2", "#180f1f", "#b8452f", "#e7d8c3"]);
  });

  it("caps the palette at six and falls back to inline styles when nothing is declared", () => {
    const many = `<style>:root{${Array.from({ length: 9 }, (_, i) => `--c${i}: #${String(i).repeat(3)}`).join(";")}}</style>`;
    expect(paletteFrom(many)).toHaveLength(6);
    expect(paletteFrom(`<p style="background:#123456">x</p>`)).toEqual(["#123456"]);
    expect(paletteFrom("<p>no colours here</p>")).toEqual([]);
  });

  it("knows how light a colour is, which is how a plate picks its ink", () => {
    expect(lightness("#ffffff")).toBeCloseTo(1, 5);
    expect(lightness("#000000")).toBeCloseTo(0, 5);
    expect(lightness("#f7efe2")).toBeGreaterThan(0.85);
  });
});

describe("facts", () => {
  it("reads the title, the first heading with its tags gone, and the description", () => {
    const facts = pageFacts(PAGE, "https://shop.example/department/home.html");
    expect(facts.title).toBe("Bamboo folding shelf rack — Hearth & Grain");
    expect(facts.h1).toBe("Bamboo folding shelf rack");
    expect(facts.description).toBe("Three tiers, folds flat in seconds.");
    expect(facts.image).toBe("https://shop.example/assets/bamboo.svg");
    expect(facts.palette[0]).toBe("#f7efe2");
  });

  it("falls back to the host and the title when a page has neither heading nor title", () => {
    const facts = pageFacts("<html><body>nothing</body></html>", "https://www.quiet.example/");
    expect(facts.title).toBe("quiet.example");
    expect(facts.h1).toBe("quiet.example");
    expect(facts.description).toBe("");
    expect(facts.image).toBeNull();
  });

  it("takes twitter's picture and then any image the page has", () => {
    expect(imageFrom(`<meta name="twitter:image" content="https://cdn.example/a.png">`, "https://x.example/")).toBe(
      "https://cdn.example/a.png"
    );
    expect(imageFrom(`<img src="pics/one.jpg" alt="">`, "https://x.example/deep/page.html")).toBe(
      "https://x.example/deep/pics/one.jpg"
    );
    expect(imageFrom(`<img src="javascript:alert(1)">`, "https://x.example/")).toBeNull();
  });

  it("decodes the entities a page actually writes", () => {
    expect(decodeText("Fish &amp; chips &#8212; &pound;9 &#x2192; now")).toBe("Fish & chips — £9 → now");
  });
});

describe("layout", () => {
  const facts = pageFacts(PAGE, "https://shop.example/product/bamboo.html");

  it("wraps at word boundaries and marks what it had to cut", () => {
    expect(wrapText("one two three four five", 9, 3)).toEqual(["one two", "three", "four five"]);
    const cut = wrapText("alpha bravo charlie delta echo foxtrot golf", 12, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
    expect(wrapText("", 10, 2)).toEqual([]);
  });

  it("draws a band of the page's own colours, its heading and the honesty line", () => {
    const layout = plateLayout(facts);
    const fills = layout.ops.filter((op) => op.kind === "fill");
    const texts = layout.ops.filter((op) => op.kind === "text");
    expect(fills.filter((op) => op.h === 12).map((op) => (op as { colour: string }).colour)).toEqual(facts.palette);
    expect(texts.some((op) => op.kind === "text" && op.text.includes("Bamboo folding"))).toBe(true);
    expect(texts.some((op) => op.kind === "text" && op.text.includes("cut from the page's own HTML"))).toBe(true);
    expect(layout.imageSlot).not.toBeNull();
  });

  it("gives the text the whole plate when the page has no picture", () => {
    const layout = plateLayout({ ...facts, image: null });
    expect(layout.imageSlot).toBeNull();
    expect(layout.ops.some((op) => op.kind === "fill" && op.x === 392)).toBe(false);
  });

  it("keeps the ink readable on a pale page and on a dark one", () => {
    const pale = plateLayout({ ...facts, palette: ["#f7efe2"], image: null });
    const dark = plateLayout({ ...facts, palette: ["#12040f"], image: null });
    const inkOf = (layout: typeof pale) =>
      (layout.ops.find((op) => op.kind === "text" && op.size === 36) as { colour: string } | undefined)?.colour;
    expect(inkOf(pale)).toBe("#12080f");
    expect(inkOf(dark)).toBe("#f6f1ff");
  });

  it("never draws outside the plate", () => {
    for (const layout of [plateLayout(facts), codePlateLayout({ path: "src/app.tsx", text: "line\n".repeat(40) })]) {
      for (const op of layout.ops) {
        if (op.kind === "fill") {
          expect(op.x).toBeGreaterThanOrEqual(0);
          expect(op.y).toBeGreaterThanOrEqual(0);
          expect(op.x + op.w).toBeLessThanOrEqual(PLATE.width + 0.001);
          expect(op.y + op.h).toBeLessThanOrEqual(PLATE.height + 0.001);
        } else {
          expect(op.x).toBeGreaterThanOrEqual(0);
          expect(op.y).toBeLessThan(PLATE.height);
        }
      }
    }
  });

  it("is deterministic: the same page always makes the same plate", () => {
    expect(JSON.stringify(plateLayout(facts))).toBe(JSON.stringify(plateLayout(pageFacts(PAGE, facts.url))));
  });
});

describe("code plates", () => {
  const source = Array.from({ length: 40 }, (_, i) => `  const line${i} = ${i};`).join("\n");

  it("shows the real lines, numbered, under the file's path", () => {
    const layout = codePlateLayout({ path: "src/components/City.tsx", text: source, lines: 12 });
    const texts = layout.ops.filter((op) => op.kind === "text").map((op) => (op as { text: string }).text);
    expect(texts[0]).toBe("src/components/City.tsx");
    expect(texts).toContain(" 1");
    expect(texts.some((line) => line.includes("const line0"))).toBe(true);
    expect(texts.some((line) => line.includes("const line12"))).toBe(false);
    expect(texts.some((line) => line.includes("28 more lines"))).toBe(true);
  });

  it("takes its accent from the palette it was given", () => {
    const layout = codePlateLayout({ path: "a.ts", text: "x", palette: ["#111111", "#b8452f"] });
    expect(layout.ops[1]).toMatchObject({ kind: "fill", colour: "#b8452f" });
  });
});
