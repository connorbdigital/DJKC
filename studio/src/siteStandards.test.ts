import { describe, expect, it } from "vitest";
import { AREA_LABEL, AREA_NOTE, STANDARDS, STATE_LABEL, byArea, gaps, tally } from "./siteStandards";

describe("the board of what a website should have", () => {
  it("has unique ids, and every line says what breaks without it", () => {
    const ids = STANDARDS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of STANDARDS) {
      expect(entry.why.length).toBeGreaterThan(40);
      expect(entry.where.length).toBeGreaterThan(10);
    }
  });

  it("gives every line two examples, both https, one of them British where possible", () => {
    for (const entry of STANDARDS) {
      expect(entry.best.length).toBe(2);
      for (const example of entry.best) {
        expect(example.href.startsWith("https://")).toBe(true);
        expect(example.why.length).toBeGreaterThan(10);
      }
    }
    const british = STANDARDS.filter((entry) => entry.best.some((example) => /\.uk(\/|$)/.test(new URL(example.href).hostname)));
    expect(british.length).toBeGreaterThan(STANDARDS.length / 3);
  });

  it("scores both sites honestly, and neither is finished", () => {
    for (const which of ["shop", "band"] as const) {
      const score = tally(which);
      expect(score.total).toBe(STANDARDS.length);
      expect(score.yes + score.partial + score.no).toBe(score.total);
      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThan(100);
      expect(score.no).toBeGreaterThan(0);
    }
  });

  it("puts the worst gaps first, and names only real gaps", () => {
    const list = gaps("shop");
    expect(list.every((entry) => entry.shop !== "yes")).toBe(true);
    expect(list[0]!.shop).toBe("no");
    const last = list[list.length - 1]!;
    expect(last.shop).toBe("partial");
  });

  it("covers every area, and every area has a label and a note", () => {
    const sections = byArea();
    expect(sections.length).toBe(7);
    const seen = sections.reduce((total, section) => total + section.entries.length, 0);
    expect(seen).toBe(STANDARDS.length);
    for (const section of sections) {
      expect(AREA_LABEL[section.area]).toBeTruthy();
      expect(AREA_NOTE[section.area].length).toBeGreaterThan(20);
      expect(section.entries.length).toBeGreaterThan(1);
    }
  });

  it("does not claim a checkout or a privacy page the repository does not have", () => {
    const byId = (id: string) => STANDARDS.find((entry) => entry.id === id)!;
    expect(byId("checkout").shop).toBe("no");
    expect(byId("privacy").shop).toBe("no");
    expect(byId("returns").shop).toBe("yes");
    expect(byId("sitemap").shop).toBe("yes");
    expect(STATE_LABEL.no).toBe("missing");
  });
});
