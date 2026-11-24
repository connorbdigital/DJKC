import { describe, expect, it } from "vitest";
import {
  ENV_KEYS,
  LINKS,
  LINK_GROUP_LABEL,
  TODOS,
  linksByGroup,
  shelfAsMarkdown,
  todosByState,
  type LinkGroup,
  type TodoState,
} from "./resources";

const GROUP_KEYS = Object.keys(LINK_GROUP_LABEL) as LinkGroup[];
const STATE_KEYS: TodoState[] = ["now", "next", "later"];

describe("the shelf", () => {
  it("every link is https, labelled, and says why you would open it", () => {
    for (const link of LINKS) {
      expect(link.href.startsWith("https://"), `${link.label} must be https`).toBe(true);
      expect(link.label.length, "a link needs a name").toBeGreaterThan(2);
      expect(link.note.length, `${link.label} needs a reason`).toBeGreaterThan(20);
    }
    expect(new Set(LINKS.map((link) => link.href)).size, "no duplicate addresses").toBe(LINKS.length);
  });

  it("fills every group, so no heading is an empty promise", () => {
    for (const group of GROUP_KEYS) {
      expect(linksByGroup(group).length, group).toBeGreaterThan(0);
    }
  });

  it("every todo has a unique id, an owner and a reason", () => {
    const ids = TODOS.map((todo) => todo.id);
    expect(new Set(ids).size, "ids must be unique").toBe(ids.length);
    for (const todo of TODOS) {
      expect(["S", "M", "L"]).toContain(todo.effort);
      expect(["studio", "site", "commerce", "repo", "ops"]).toContain(todo.where);
      expect(todo.why.length, `${todo.title} needs a reason`).toBeGreaterThan(30);
    }
  });

  it("has work in every column, and 'now' stays short enough to act on", () => {
    for (const state of STATE_KEYS) {
      expect(todosByState(state).length, state).toBeGreaterThan(0);
    }
    expect(todosByState("now").length, "'now' is not a backlog").toBeLessThanOrEqual(5);
  });

  it("names keys the way code reads them, and never pairs a key with itself twice", () => {
    for (const entry of ENV_KEYS) {
      expect(/^[A-Z][A-Z0-9_]+$/.test(entry.key), entry.key).toBe(true);
      expect(entry.without.length, entry.key).toBeGreaterThan(3);
    }
    const pairs = ENV_KEYS.map((entry) => `${entry.project}:${entry.key}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("renders to Markdown that carries every task and every link", () => {
    const markdown = shelfAsMarkdown();
    for (const todo of TODOS) expect(markdown).toContain(todo.title);
    for (const link of LINKS) expect(markdown).toContain(link.href);
    expect(markdown).toContain("## The shelf");
  });
});
