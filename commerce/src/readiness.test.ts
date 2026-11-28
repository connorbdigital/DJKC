import { describe, expect, it } from "vitest";
import { readiness } from "./readiness";

const equipped = {
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  KV_REST_API_URL: "https://kv.example",
  KV_REST_API_TOKEN: "t",
  SUPPLIER_NAME: "prodigi",
  PRODIGI_API_KEY: "sandbox_example",
  PRODIGI_ITEMS: JSON.stringify({ "HG-PRINT-01": { sku: "GLOBAL-CAN-16X20", asset: "https://shop.example/art.png" } }),
};

describe("readiness", () => {
  it("says nothing works when nothing is set, and names the first thing to do", () => {
    const report = readiness({});
    expect(report.canTakeMoney).toBe(false);
    expect(report.canRecordOrders).toBe(false);
    expect(report.canFulfilAutomatically).toBe(false);
    expect(report.next).toMatch(/STRIPE_SECRET_KEY/);
    expect(report.checks.find((check) => check.name === "STRIPE_SECRET_KEY")?.state).toBe("missing");
  });

  it("does not confuse taking money with being able to record it", () => {
    const stripeOnly = readiness({ STRIPE_SECRET_KEY: "sk_test_example" });
    expect(stripeOnly.canTakeMoney).toBe(true);
    expect(stripeOnly.canRecordOrders).toBe(false);
    expect(stripeOnly.next).toMatch(/webhook endpoint/);
  });

  it("knows a test key from a live one without printing either", () => {
    const report = readiness({ ...equipped, STRIPE_SECRET_KEY: "sk_live_example" });
    const check = report.checks.find((entry) => entry.name === "STRIPE_SECRET_KEY")!;
    expect(check.note).toBe("live key");
    expect(JSON.stringify(report)).not.toContain("sk_live_example");
  });

  it("is complete only when all three stages are", () => {
    const report = readiness(equipped);
    expect(report).toMatchObject({ canTakeMoney: true, canRecordOrders: true, canFulfilAutomatically: true, supplier: "prodigi" });
    expect(report.next).toMatch(/sandbox order/);
  });

  it("asks for the supplier key that matches the supplier named", () => {
    const report = readiness({ ...equipped, SUPPLIER_NAME: "bigbuy", BIGBUY_API_KEY: "" });
    expect(report.canFulfilAutomatically).toBe(false);
    expect(report.next).toMatch(/BIGBUY_API_KEY/);
  });

  it("reports a broken PRODIGI_ITEMS as broken, not as missing", () => {
    const report = readiness({ ...equipped, PRODIGI_ITEMS: "{not json" });
    const check = report.checks.find((entry) => entry.name === "PRODIGI_ITEMS")!;
    expect(check.state).toBe("invalid");
    expect(check.note).toMatch(/not readable JSON/);
  });

  it("accepts Upstash's own variable names as well as Vercel KV's", () => {
    const report = readiness({
      ...equipped,
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "https://upstash.example",
      UPSTASH_REDIS_REST_TOKEN: "t",
    });
    expect(report.canRecordOrders).toBe(true);
  });
});
