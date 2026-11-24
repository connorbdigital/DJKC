import { describe, expect, it } from "vitest";
import { CAPABILITIES, capabilityById } from "./features";

describe("feature library", () => {
  it("has unique ids and a summary for every capability", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const capability of CAPABILITIES) {
      expect(capability.summary.length).toBeGreaterThan(30);
      expect(capability.files.length).toBeGreaterThan(0);
      expect(capability.manual.length).toBeGreaterThan(0);
    }
  });

  it("only depends on capabilities that exist", () => {
    for (const capability of CAPABILITIES) {
      for (const dependency of capability.requires) {
        if (dependency === "storage") continue; // satisfied by the hosting platform
        expect(capabilityById(dependency), `${capability.id} needs ${dependency}`).toBeTruthy();
      }
    }
  });

  it("points at real files in the source project", async () => {
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    for (const capability of CAPABILITIES) {
      for (const file of capability.files) {
        expect(existsSync(path.join("..", file.path)), `${capability.id} → ${file.path}`).toBe(true);
      }
    }
  });
});
