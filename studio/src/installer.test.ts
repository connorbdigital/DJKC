import { describe, expect, it } from "vitest";
import { branchName, extractImports, installBody, resolveImport, targetPath } from "./installer";
import { capabilityById } from "./features";

describe("installer", () => {
  it("places files under the chosen prefix", () => {
    expect(targetPath("", "api/store.ts")).toBe("api/store.ts");
    expect(targetPath("src/features/", "api/store.ts")).toBe("src/features/api/store.ts");
    expect(targetPath("/vendor/", "api/store.ts")).toBe("vendor/api/store.ts");
  });

  it("names branches predictably from the id and the clock", () => {
    expect(branchName("sticky-cta-bar", new Date("2026-11-24T05:30:00Z"))).toBe("studio/feature-sticky-cta-bar-2026-11-24-05-30");
  });

  it("writes a pull request body that admits what still needs doing", () => {
    const capability = capabilityById("booking-form-deposits")!;
    const body = installBody(capability, {
      source: "connorbdigital/DJKC",
      prefix: "vendor/booking",
      paths: ["vendor/booking/api/bookings.ts", "vendor/booking/src/components/Booking.tsx"],
    });
    expect(body).toContain("Adds **Booking form with Stripe deposits**");
    expect(body).toContain("vendor/booking/api/bookings.ts");
    expect(body).toContain("Needs editing after merge");
    expect(body).toContain("STRIPE_SECRET_KEY");
    expect(body).toContain("Do not merge until");
    expect(body).toContain("studio/features.json");
    expect(body).toContain("Copied from `connorbdigital/DJKC`");
  });
});

describe("preflight helpers", () => {
  it("finds relative imports and ignores packages", () => {
    const source = [
      'import { useMemo } from "react";',
      'import { TIERS } from "../data";',
      "import { Reveal } from './Reveal';",
      'const lazy = import("./panel");',
    ].join("\n");
    expect(extractImports(source).sort()).toEqual(["../data", "./Reveal", "./panel"].sort());
  });

  it("resolves an import against the importing file, with extensions", () => {
    const candidates = resolveImport("src/components/Booking.tsx", "../data");
    expect(candidates).toContain("src/data");
    expect(candidates).toContain("src/data.ts");
    expect(candidates).toContain("src/data.tsx");
  });

  it("handles parent chains without wandering above the repo", () => {
    const candidates = resolveImport("api/bookings.ts", "./store.js");
    expect(candidates[0]).toBe("api/store.js");
    expect(resolveImport("a.ts", "../../../etc/passwd")[0]).toBe("etc/passwd");
  });

  it("writes the check results into the pull request body", () => {
    const capability = capabilityById("booking-form-deposits")!;
    const body = installBody(capability, {
      source: "connorbdigital/DJKC",
      prefix: "feature",
      paths: ["feature/api/bookings.ts"],
      preflight: {
        files: [{ source: "api/bookings.ts", destination: "feature/api/bookings.ts", bytes: 4200, exists: false }],
        collisions: ["feature/api/bookings.ts"],
        unresolved: [{ file: "src/components/Booking.tsx", specifier: "../data" }],
        missingDependencies: ["storage-kv"],
      },
    });
    expect(body).toContain("Checked before writing");
    expect(body).toContain("Overwrote an existing file");
    expect(body).toContain("../data");
    expect(body).toContain("storage-kv");
  });
});
