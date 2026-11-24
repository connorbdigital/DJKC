import { describe, expect, it } from "vitest";
import { mergeActivity, toCommitEvent, toPullEvent, toRepo } from "./github";

const commit = toCommitEvent({
  sha: "abcdef1234567890",
  html_url: "https://github.com/o/r/commit/abcdef1",
  commit: { message: "Add booking form\n\nLonger body here", author: { name: "A Dev", date: "2026-11-20T10:00:00Z" } },
});

const pull = toPullEvent({
  number: 9,
  title: "Add a booking desk",
  state: "closed",
  merged_at: "2026-11-24T05:35:48Z",
  user: { login: "connorbdigital" },
  html_url: "https://github.com/o/r/pull/9",
  updated_at: "2026-11-24T05:35:48Z",
});

describe("github adapters", () => {
  it("keeps only the first line of a commit message", () => {
    expect(commit.title).toBe("Add booking form");
    expect(commit.id).toBe("abcdef1");
  });

  it("marks a closed pull as merged only when it was merged", () => {
    expect(pull.merged).toBe(true);
    expect(pull.state).toBe("closed");
    expect(pull.id).toBe("#9");
  });

  it("merges commits and pulls newest first", () => {
    const list = mergeActivity([commit], [pull]);
    expect(list.map((event) => event.kind)).toEqual(["pull", "commit"]);
  });

  it("normalises a repository", () => {
    const repo = toRepo({
      id: 1,
      full_name: "connorbdigital/DJKC",
      name: "DJKC",
      private: true,
      description: "DJ site",
      default_branch: "main",
      updated_at: "2026-11-24T05:35:48Z",
      language: "TypeScript",
      html_url: "https://github.com/connorbdigital/DJKC",
      owner: { login: "connorbdigital" },
    });
    expect(repo.owner).toBe("connorbdigital");
    expect(repo.defaultBranch).toBe("main");
    expect(repo.private).toBe(true);
  });
});
