import { describe, expect, it } from "vitest";
import { NOTE_LIMIT, mergeNodeNotes, noteCount, parseNodeNotes, setNodeNote } from "./nodeNotes";

describe("notes pinned to a node", () => {
  it("reads back what it was given, and nothing else", () => {
    expect(parseNodeNotes({ "project-djkc": "deposit is a stub" })).toEqual({ "project-djkc": "deposit is a stub" });
    expect(parseNodeNotes(null)).toEqual({});
    expect(parseNodeNotes("nonsense")).toEqual({});
    expect(parseNodeNotes([1, 2, 3])).toEqual({});
    expect(parseNodeNotes({ a: 42, b: null, c: "  ", d: "kept" })).toEqual({ d: "kept" });
  });

  it("caps a note rather than trusting the clipboard", () => {
    const long = parseNodeNotes({ a: "x".repeat(NOTE_LIMIT + 500) });
    expect(long.a).toHaveLength(NOTE_LIMIT);
  });

  it("deletes on empty, and leaves the rest alone", () => {
    const notes = setNodeNote({ a: "one", b: "two" }, "a", "   ");
    expect(notes).toEqual({ b: "two" });
    expect(setNodeNote({}, "a", "one")).toEqual({ a: "one" });
    expect(setNodeNote({ a: "one" }, "", "x")).toEqual({ a: "one" });
  });

  it("counts the notes that are really there", () => {
    expect(noteCount({ a: "x", b: "", c: "  " })).toBe(1);
    expect(noteCount({})).toBe(0);
  });

  it("merges a gist in without losing local work", () => {
    const merged = mergeNodeNotes({ a: "mine", b: "" }, { a: "theirs", c: "only there" });
    expect(merged).toEqual({ a: "mine", c: "only there" });
  });
});
