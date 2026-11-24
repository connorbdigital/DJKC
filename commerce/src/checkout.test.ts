import { describe, expect, it } from "vitest";
import { auditFlow, checkoutFlow, defaultCheckout, FORM_ELEMENT_BUDGET, totalFields, type CheckoutConfig } from "./checkout";

describe("checkout", () => {
  it("ships a guest-first flow that stays inside the field budget", () => {
    const config = defaultCheckout();
    expect(auditFlow(config)).toEqual([]);
    expect(totalFields(checkoutFlow(config))).toBe(7);
    expect(totalFields(checkoutFlow(config))).toBeLessThanOrEqual(FORM_ELEMENT_BUDGET);
  });

  it("shows the total before the payment step, not at it", () => {
    const steps = checkoutFlow(defaultCheckout());
    const payment = steps.findIndex((step) => step.id === "payment");
    expect(payment).toBeGreaterThan(0);
    expect(steps.slice(0, payment).every((step) => step.showsTotal)).toBe(true);
  });

  it("refuses an account wall", () => {
    const config: CheckoutConfig = { ...defaultCheckout(), account: "required" };
    const issues = auditFlow(config);
    expect(issues.map((issue) => issue.rule)).toContain("guest-checkout");
    expect(issues.find((issue) => issue.rule === "guest-checkout")?.because).toMatch(/abandonment/);
  });

  it("complains when the address is typed and no wallet is offered", () => {
    const config: CheckoutConfig = {
      ...defaultCheckout(),
      addressLookup: false,
      wallets: [],
      methods: ["bank-transfer"],
    };
    const rules = auditFlow(config).map((issue) => issue.rule);
    expect(rules).toContain("address-lookup");
    expect(rules).toContain("express-wallet");
    expect(rules).toContain("payment-choice");
  });

  it("treats pre-ticked marketing consent as a defect", () => {
    const config: CheckoutConfig = { ...defaultCheckout(), marketingOptIn: "preselected" };
    expect(auditFlow(config).map((issue) => issue.rule)).toContain("consent");
  });

  it("adds up the fields so a bloated flow fails loudly", () => {
    const bloated = { ...defaultCheckout() };
    const steps = checkoutFlow(bloated).map((step) => ({
      ...step,
      fields: [...step.fields, ...step.fields, ...step.fields],
    }));
    expect(totalFields(steps)).toBeGreaterThan(FORM_ELEMENT_BUDGET);
  });
});
