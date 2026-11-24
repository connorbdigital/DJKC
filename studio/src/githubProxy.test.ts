import { describe, expect, it } from "vitest";
import { GITHUB_API, allowsMethod, proxyTarget } from "./githubProxy";

describe("the GitHub proxy rules", () => {
  it("forwards the reads the Studio actually makes", () => {
    for (const path of [
      "/user",
      "/user/repos?per_page=100&sort=updated",
      "/repos/connorbdigital/DJKC",
      "/repos/connorbdigital/DJKC/commits?per_page=25",
      "/repos/connorbdigital/DJKC/contents/src/data.ts?ref=main",
      "/repos/connorbdigital/DJKC/git/trees/main?recursive=1",
      "/repos/connorbdigital/DJKC/pulls?state=all",
      "/repos/connorbdigital/DJKC/commits/main/check-runs?per_page=20",
      "/search/code?per_page=30&q=repo%3Aconnorbdigital%2FDJKC+cart",
      "/rate_limit",
    ]) {
      const target = proxyTarget(path);
      expect(target.ok, path).toBe(true);
      if (target.ok) expect(target.url.startsWith(GITHUB_API)).toBe(true);
    }
  });

  it("refuses the ways a proxy gets pointed somewhere else", () => {
    for (const path of [
      "https://evil.example/user",
      "//evil.example/user",
      "/repos/../../user",
      "/repos/a\\b",
      "/repos/user@evil.example/repo",
      "/user /../x",
      "/repos/",
      "/admin/users",
      "",
      "user",
    ]) {
      expect(proxyTarget(path).ok, JSON.stringify(path)).toBe(false);
    }
    expect(proxyTarget(undefined).ok).toBe(false);
    expect(proxyTarget("/user".repeat(200)).ok).toBe(false);
  });

  it("is read-only: GET is the only method that passes", () => {
    expect(allowsMethod("GET")).toBe(true);
    expect(allowsMethod("post")).toBe(false);
    expect(allowsMethod("PUT")).toBe(false);
    expect(allowsMethod(undefined)).toBe(false);
  });
});
