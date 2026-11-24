import { describe, expect, it } from "vitest";
import { defaultRules, rulesBrief, serialiseRules } from "./project";

describe("project rules", () => {
  it("scaffolds a usable studio.json", () => {
    const rules = defaultRules("connorbdigital/Kaysie");
    expect(rules.name).toBe("Kaysie");
    expect(rules.rules.length).toBeGreaterThan(2);
    expect(JSON.parse(serialiseRules(rules))).toEqual(rules);
  });

  it("turns rules into a prompt brief", () => {
    const brief = rulesBrief(
      JSON.stringify({
        version: 1,
        name: "Kaysie",
        summary: "Singer website",
        stack: ["Vite", "React"],
        rules: ["Prices in GBP", "Logo stays pink"],
        design: { palette: "pink on near-black", type: "", voice: "warm" },
      })
    );
    expect(brief).toContain("Project: Kaysie");
    expect(brief).toContain("Prices in GBP");
    expect(brief).toContain("palette — pink on near-black");
    expect(brief).toContain("voice — warm");
    expect(brief).not.toContain("type —");
  });

  it("returns nothing rather than throwing on a broken file", () => {
    expect(rulesBrief("{not json")).toBe("");
    expect(rulesBrief(null)).toBe("");
    expect(rulesBrief("{}")).toBe("");
  });
});
