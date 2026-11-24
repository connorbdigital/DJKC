import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES, CATEGORIES, inCategory } from "./features";
import { BUILDER_STEPS, processDocMarkdown, shelfSummaryMarkdown } from "./processDoc";

const doc = processDocMarkdown();

describe("the process catalogue", () => {
  it("gives every process a reason and a consequence", () => {
    for (const capability of CAPABILITIES) {
      expect(capability.why.length, `${capability.id} has no reason`).toBeGreaterThan(60);
      expect(capability.without.length, `${capability.id} has no consequence`).toBeGreaterThan(40);
      expect(capability.why, `${capability.id} repeats its summary`).not.toBe(capability.summary);
    }
  });

  it("gives every shelf a reason too", () => {
    for (const category of CATEGORIES) {
      expect(category.why.length, `${category.id} has no reason`).toBeGreaterThan(60);
    }
  });

  it("covers every process and every shelf in the document", () => {
    for (const capability of CAPABILITIES) {
      expect(doc).toContain(`### ${capability.name}`);
      expect(doc).toContain(capability.why);
      expect(doc).toContain(capability.without);
    }
    for (const category of CATEGORIES) expect(doc).toContain(`## ${category.label}`);
    expect(doc.match(/^### /gm)).toHaveLength(CAPABILITIES.length + BUILDER_STEPS.length);
  });

  it("documents the builder's own steps", () => {
    for (const step of BUILDER_STEPS) {
      expect(doc).toContain(`### ${step.name}`);
      expect(step.why.length).toBeGreaterThan(40);
    }
  });

  it("links to shelves with anchors GitHub will actually resolve", () => {
    const anchor = (label: string) =>
      label.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (const category of CATEGORIES) expect(doc).toContain(`](#${anchor(category.label)})`);
    expect(doc).not.toContain("(&");
  });

  it("counts what it claims to count", () => {
    for (const category of CATEGORIES) {
      const count = inCategory(category.id).length;
      expect(doc).toContain(`${count} process${count === 1 ? "" : "es"}`);
    }
    expect(doc).toContain(`${CAPABILITIES.length} processes on ${CATEGORIES.length} shelves`);
  });

  it("keeps the checked-in PROCESSES.md current", () => {
    const file = readFileSync(path.join(__dirname, "..", "PROCESSES.md"), "utf8");
    expect(file).toBe(doc);
  });

  it("has a short version for a brief", () => {
    const short = shelfSummaryMarkdown();
    expect(short).toContain("# Why these processes exist");
    for (const category of CATEGORIES) expect(short).toContain(`## ${category.label}`);
    expect(short.length).toBeLessThan(doc.length);
  });
});
