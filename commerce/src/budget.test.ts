import { describe, expect, it } from "vitest";
import { BUDGETS, auditMarkup, checkBudgets, verdict } from "./budget";

const healthy = { lcp: 1800, inp: 140, cls: 0.02, jsKb: 98, imageKb: 160, requests: 28, contrast: 7.2, targetSize: 44 };

describe("budgets", () => {
  it("passes a shop that meets every measure", () => {
    expect(checkBudgets(healthy).failures).toEqual([]);
    expect(verdict(healthy)).toBe("Within budget on every measure.");
  });

  it("fails a shop that is only slightly heavy, and says why", () => {
    const { failures } = checkBudgets({ ...healthy, lcp: 2400, jsKb: 210 });
    expect(failures.map((failure) => failure.budget.id)).toEqual(["lcp", "jsKb"]);
    expect(failures[0]!.because).toMatch(/product images|revenue/);
    expect(verdict({ ...healthy, lcp: 2400 })).toContain("Largest Contentful Paint 2400ms");
  });

  it("treats an unmeasured metric as unproven, not as passing", () => {
    const { jsKb, ...rest } = healthy;
    void jsKb;
    const { missing, failures } = checkBudgets(rest);
    expect(failures).toEqual([]);
    expect(missing.map((budget) => budget.id)).toEqual(["jsKb"]);
    expect(verdict(rest)).toMatch(/Not measured: JavaScript shipped/);
  });

  it("enforces floors as well as ceilings", () => {
    const { failures } = checkBudgets({ ...healthy, contrast: 3.1, targetSize: 18 });
    expect(failures.map((failure) => failure.budget.id)).toEqual(["contrast", "targetSize"]);
    expect(failures[0]!.budget.direction).toBe("min");
  });

  it("states every budget as a number with a reason", () => {
    for (const budget of BUDGETS) {
      expect(budget.target).toBeGreaterThan(0);
      expect(budget.because.length).toBeGreaterThan(20);
      expect(["max", "min"]).toContain(budget.direction);
    }
  });
});

describe("markup audit", () => {
  it("finds the failures that actually block a screen reader", () => {
    const findings = auditMarkup({
      buttons: [
        { label: "", sizePx: 44 },
        { label: "Add to basket", sizePx: 20 },
      ],
      images: [
        { src: "https://cdn.example.com/hoodie.jpg", alt: "" },
        { src: "https://cdn.example.com/spacer.png", alt: "" },
      ],
      inputs: [
        { name: "email", label: "Email", errorDescribed: false },
        { name: "card", label: "", errorDescribed: true },
      ],
    });
    const problems = findings.map((finding) => `${finding.where}:${finding.problem}`);
    expect(problems).toContain("button:button has no accessible name");
    expect(problems.some((entry) => entry.includes("20px tap target"))).toBe(true);
    expect(problems.some((entry) => entry.includes("hoodie.jpg"))).toBe(true);
    expect(problems.some((entry) => entry.includes("spacer.png"))).toBe(false);
    expect(problems).toContain("email:validation error is visual only");
    expect(problems).toContain("card:input has no label");
    expect(findings.every((finding) => /^\d\.\d\.\d$/.test(finding.wcag))).toBe(true);
  });

  it("passes a page that names everything", () => {
    expect(
      auditMarkup({
        buttons: [{ label: "Place order", sizePx: 48 }],
        images: [{ src: "https://cdn.example.com/hoodie.jpg", alt: "Charcoal hoodie, front" }],
        inputs: [{ name: "email", label: "Email", errorDescribed: true }],
      })
    ).toEqual([]);
  });
});
