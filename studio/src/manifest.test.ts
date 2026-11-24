import { describe, expect, it } from "vitest";
import { MANIFEST_PATH, mergeManifest, parseManifest } from "./installer";
import type { InstalledFeature } from "./types";

const entry = (id: string, version = "1.0.0"): InstalledFeature => ({
  id,
  name: id,
  version,
  source: "connorbdigital/DJKC",
  sourceCommit: "5c012cb9076fa6bea0e31ef3c7720a20591e74f4",
  installedAt: "2026-11-24T06:20:00.000Z",
  files: [`${id}/file.ts`],
});

describe("studio manifest", () => {
  it("lives at a predictable path", () => {
    expect(MANIFEST_PATH).toBe("studio/features.json");
  });

  it("starts from nothing without complaining", () => {
    expect(parseManifest(null).features).toEqual([]);
    expect(parseManifest("nonsense").features).toEqual([]);
  });

  it("adds a feature with its version and source commit", () => {
    const file = mergeManifest(null, entry("booking-form-deposits"));
    const parsed = JSON.parse(file);
    expect(parsed.version).toBe(1);
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].version).toBe("1.0.0");
    expect(parsed.features[0].sourceCommit).toHaveLength(40);
  });

  it("replaces rather than duplicates, and keeps the list sorted", () => {
    const first = mergeManifest(null, entry("theme-colour"));
    const both = mergeManifest(first, entry("booking-form-deposits"));
    const upgraded = mergeManifest(both, entry("theme-colour", "1.1.0"));
    const parsed = JSON.parse(upgraded);
    expect(parsed.features.map((f: InstalledFeature) => f.id)).toEqual(["booking-form-deposits", "theme-colour"]);
    expect(parsed.features[1].version).toBe("1.1.0");
  });

  it("ends with a newline so diffs stay clean", () => {
    expect(mergeManifest(null, entry("x")).endsWith("\n")).toBe(true);
  });
});
