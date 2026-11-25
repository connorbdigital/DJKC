import { describe, expect, it } from "vitest";
import { isSubsequence, matchCommands, scoreCommand, type Command } from "./palette";

const command = (label: string, aliases?: string[]): Command => ({ id: label, label, aliases, run: () => {} });
const labels = (query: string, commands: Command[]) => matchCommands(query, commands).map((entry) => entry.label);

describe("the command palette's matching", () => {
  const commands = [command("Projects"), command("Feature library"), command("Search"), command("Shelf"), command("Atlas (3D)")];

  it("keeps the given order until something is typed", () => {
    expect(labels("", commands)).toEqual(commands.map((entry) => entry.label));
  });

  it("puts a label that starts with the query above one that only contains it", () => {
    expect(scoreCommand("sea", commands[2]!)).toBe(3);
    expect(scoreCommand("ure", commands[1]!)).toBe(1);
    expect(labels("sea", commands)).toEqual(["Search"]);
  });

  it("matches the start of a word inside a label", () => {
    expect(scoreCommand("lib", commands[1]!)).toBe(2);
    expect(labels("lib", commands)).toEqual(["Feature library"]);
  });

  it("finds letters in order, and only in order", () => {
    expect(isSubsequence("srh", "search")).toBe(true);
    expect(isSubsequence("hrs", "search")).toBe(false);
    expect(labels("srh", commands)).toEqual(["Search"]);
    expect(labels("zzz", commands)).toEqual([]);
  });

  it("matches aliases, so the old names still work", () => {
    expect(scoreCommand("todo", command("Shelf", ["todo list"]))).toBe(2);
    expect(labels("todo", [command("Shelf", ["todo list"]), command("Search")])).toEqual(["Shelf"]);
  });

  it("ignores case and surrounding spaces", () => {
    expect(labels("  SEARCH ", commands)).toEqual(["Search"]);
  });
});
