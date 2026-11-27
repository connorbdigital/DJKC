import { describe, expect, it } from "vitest";
import { readmeFor, repoName } from "../scripts/publish-anything";

const app = {
  id: "prj_kaysie01",
  name: "Kaysie — the DJ site",
  organizationName: "connorbdigital",
  platform: "web",
  modules: ["Home", "Booking form", "Prices", "Checkout", "Gallery", "FAQ", "Admin dashboard"],
  moduleCount: 7,
  url: "https://kaysie.example",
  updatedAt: "2026-11-18T10:00:00Z",
};

describe("publishing an Anything project to GitHub", () => {
  it("makes a repository name GitHub will accept", () => {
    expect(repoName("Kaysie — the DJ site", "x")).toBe("anything-kaysie-the-dj-site");
    expect(repoName("  ", "prj_abc_1")).toBe("anything-prj-abc-1");
    expect(repoName("A".repeat(200), "x").length).toBeLessThanOrEqual(69);
  });

  it("writes a README that says what the project is, part by part", () => {
    const readme = readmeFor(app, "2026-11-20T00:00:00.000Z");
    expect(readme).toContain("# Kaysie — the DJ site");
    expect(readme).toContain("prj_kaysie01");
    expect(readme).toContain("https://kaysie.example");
    expect(readme).toContain("Booking form — takes or manages an enquiry");
    expect(readme).toContain("Checkout — moves money or stock");
    expect(readme).toContain("## What this is not");
  });

  it("is honest about what cannot be downloaded", () => {
    const readme = readmeFor(app, "2026-11-20T00:00:00.000Z");
    expect(readme).toContain("inventory, not a repository");
    expect(readme).toContain("contains no source");
  });

  it("regenerates the same README for the same scan", () => {
    expect(readmeFor(app, "2026-11-20")).toBe(readmeFor(app, "2026-11-20"));
  });
});
