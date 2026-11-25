import { describe, expect, it } from "vitest";
import { GIST_FILENAME, buildBundle, describeBundle, isGistId, mergeBundle, parseBundle, serialiseBundle } from "./notesSync";

describe("notes that travel to another device", () => {
  const bundle = buildBundle("the January dates are not confirmed", { "project-djkc": "deposit is a stub" }, "2026-11-20T10:00:00.000Z");

  it("round-trips through the file it writes", () => {
    const parsed = parseBundle(serialiseBundle(bundle));
    expect(parsed?.notes).toBe(bundle.notes);
    expect(parsed?.nodeNotes).toEqual(bundle.nodeNotes);
    expect(parsed?.updatedAt).toBe(bundle.updatedAt);
  });

  it("writes a file name a gist can hold", () => {
    expect(GIST_FILENAME.endsWith(".json")).toBe(true);
    expect(JSON.parse(serialiseBundle(bundle)).nodeNotes["project-djkc"]).toBe("deposit is a stub");
  });

  it("refuses junk instead of wiping the notes", () => {
    expect(parseBundle(null)).toBeNull();
    expect(parseBundle("")).toBeNull();
    expect(parseBundle("{")).toBeNull();
    expect(parseBundle(JSON.stringify({ version: 1, notes: "  ", nodeNotes: {} }))).toBeNull();
    expect(parseBundle(JSON.stringify({ notes: "hello" }))?.notes).toBe("hello");
  });

  it("keeps the local note when both sides have one, and fills the gaps", () => {
    const local = buildBundle("mine", { a: "mine" }, "2026-11-20T09:00:00.000Z");
    const remote = buildBundle("theirs", { a: "theirs", b: "theirs only" }, "2026-11-19T09:00:00.000Z");
    const merged = mergeBundle(local, remote);
    expect(merged.notes).toBe("mine");
    expect(merged.nodeNotes).toEqual({ a: "mine", b: "theirs only" });
  });

  it("takes the remote text when this device has none", () => {
    const merged = mergeBundle(buildBundle("", {}, "2026-11-18T09:00:00.000Z"), buildBundle("from the laptop", {}, "2026-11-20T09:00:00.000Z"));
    expect(merged.notes).toBe("from the laptop");
    expect(merged.updatedAt).toBe("2026-11-20T09:00:00.000Z");
  });

  it("describes what came back in one line", () => {
    expect(describeBundle(bundle)).toMatch(/^1 pinned note and 35 characters, saved /);
    expect(describeBundle(buildBundle("", {}, ""))).toMatch(/saved at an unknown time/);
  });

  it("only accepts something shaped like a gist id", () => {
    expect(isGistId("aa11bb22cc33dd44ee55ff66aa77bb88")).toBe(true);
    expect(isGistId("not-a-gist")).toBe(false);
    expect(isGistId("")).toBe(false);
  });
});
