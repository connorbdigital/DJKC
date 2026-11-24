import { describe, expect, it } from "vitest";
import { CAPABILITIES, capabilityById } from "./features";
import { extractImports, resolveImport } from "./installer";

describe("feature library", () => {
  it("has unique ids and a summary for every capability", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const capability of CAPABILITIES) {
      expect(capability.summary.length).toBeGreaterThan(30);
      expect(capability.files.length).toBeGreaterThan(0);
      expect(capability.manual.length).toBeGreaterThan(0);
      expect(capability.version).toMatch(/^\d+\.\d+\.\d+$/);
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

  it("brings every file it needs, or says whose it is", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const strip = (value: string) => value.replace(/\.(tsx|ts|jsx|js|mts|css)$/, "");
    const gaps: string[] = [];

    for (const capability of CAPABILITIES) {
      /* What this capability can count on: its own files, its dependencies'
       * files, and the project files it declares it reads. */
      const declared = new Set<string>();
      const collect = (id: string, depth = 0) => {
        const entry = capabilityById(id);
        if (!entry || depth > 5) return;
        for (const file of entry.files) declared.add(strip(file.path));
        for (const requirement of entry.requires) collect(requirement, depth + 1);
      };
      collect(capability.id);
      for (const expectation of capability.expects) declared.add(strip(expectation.path));
      for (const file of capability.files) {
        if (!/\.(tsx|ts|jsx|js|mts)$/.test(file.path)) continue;
        let content = "";
        try {
          content = readFileSync(path.join("..", file.path), "utf8");
        } catch {
          continue;
        }
        for (const specifier of extractImports(content)) {
          const resolved = resolveImport(file.path, specifier).map(strip);
          if (!resolved.some((candidate) => declared.has(candidate))) {
            gaps.push(`${capability.id}: ${file.path} imports ${specifier}`);
          }
        }
      }
    }

    expect(gaps).toEqual([]);
  });
});
