import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APEX_AUDIT_BRIEF, BRIEF_MAX, briefLength } from "./anythingAudit";
import { PROMPT_MAX, PROMPT_MIN } from "./anything";

/**
 * The brief travels as a string, so nothing type-checks what is in it. These are
 * the checks that keep it honest: it must be sendable, it must still contain the
 * findings the audit paid for, and it must not quietly drift from the long version
 * in the docs that a human reads.
 */
describe("the brief this Studio sends", () => {
  it("is long enough to be a brief and short enough for one request", () => {
    const length = briefLength();
    expect(length).toBeGreaterThanOrEqual(PROMPT_MIN);
    expect(length).toBeLessThanOrEqual(Math.min(PROMPT_MAX, BRIEF_MAX));
    expect(APEX_AUDIT_BRIEF.prompt.startsWith("You are fixing")).toBe(true);
  });

  it("keeps the findings that cost the audit the most to find", () => {
    for (const anchor of APEX_AUDIT_BRIEF.nonNegotiables) {
      expect(APEX_AUDIT_BRIEF.prompt).toContain(anchor);
    }
    /* The three that make the brief about *this* site rather than any site. */
    expect(APEX_AUDIT_BRIEF.prompt).toContain("sitebuildup.co.uk");
    expect(APEX_AUDIT_BRIEF.prompt).toContain("BoostSales");
    expect(APEX_AUDIT_BRIEF.prompt).toContain("020 7946 0958");
    expect(APEX_AUDIT_BRIEF.prompt).toContain("llms.txt");
  });

  it("says what done looks like, and what not to do", () => {
    expect(APEX_AUDIT_BRIEF.prompt).toContain("ACCEPTANCE");
    expect(APEX_AUDIT_BRIEF.prompt).toContain("DO NOT");
    /* A brief without a stopping condition is a brief an agent guesses at. */
    expect(APEX_AUDIT_BRIEF.prompt).toMatch(/before you stop/i);
  });

  it("still agrees with the long version in the docs", () => {
    const doc = readFileSync("../docs/anything-prompt-digital-solutions-agency.md", "utf8");
    for (const anchor of ["sitebuildup.co.uk", "BoostSales", "020 7946", "llms.txt", "DMCC", "0+"]) {
      expect(doc).toContain(anchor);
      expect(APEX_AUDIT_BRIEF.prompt).toContain(anchor);
    }
    /* The audit the brief comes from has to exist, or the citation is a fiction. */
    expect(APEX_AUDIT_BRIEF.source).toBe("docs/sitebuildup-apex-audit-2026-11-20.md");
    expect(readFileSync(`../${APEX_AUDIT_BRIEF.source}`, "utf8")).toContain("34/100");
  });
});
