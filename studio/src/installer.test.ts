import { describe, expect, it } from "vitest";
import { branchName, installBody, targetPath } from "./installer";
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
    expect(body).toContain("Copied from `connorbdigital/DJKC`");
  });
});
