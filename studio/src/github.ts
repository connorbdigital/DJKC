import type { ActivityEvent, CommitEvent, PullEvent, Repo } from "./types";

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep the status line */
    }
    throw new GithubError(detail, response.status);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

interface RawRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  language: string | null;
  html_url: string;
  owner: { login: string };
}

export const toRepo = (raw: RawRepo): Repo => ({
  id: raw.id,
  fullName: raw.full_name,
  name: raw.name,
  owner: raw.owner.login,
  private: raw.private,
  description: raw.description,
  defaultBranch: raw.default_branch,
  updatedAt: raw.updated_at,
  language: raw.language,
  htmlUrl: raw.html_url,
});

export async function listRepos(token: string): Promise<Repo[]> {
  const repos = await gh<RawRepo[]>(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
  return repos.map(toRepo);
}

export async function whoami(token: string): Promise<{ login: string; name: string | null }> {
  return gh(token, "/user");
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
}

interface RawPull {
  number: number;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  user: { login: string };
  html_url: string;
  updated_at: string;
}

const firstLine = (message: string) => message.split("\n")[0]?.slice(0, 140) ?? "(no message)";

export const toCommitEvent = (raw: RawCommit): CommitEvent => ({
  kind: "commit",
  id: raw.sha.slice(0, 7),
  title: firstLine(raw.commit.message),
  author: raw.commit.author?.name ?? "unknown",
  at: raw.commit.author?.date ?? "",
  url: raw.html_url,
});

export const toPullEvent = (raw: RawPull): PullEvent => ({
  kind: "pull",
  id: `#${raw.number}`,
  number: raw.number,
  title: raw.title,
  state: raw.state,
  merged: Boolean(raw.merged_at),
  author: raw.user.login,
  at: raw.merged_at ?? raw.updated_at,
  url: raw.html_url,
});

/** Newest first, commits and pull requests merged into one readable history. */
export function mergeActivity(commits: CommitEvent[], pulls: PullEvent[]): ActivityEvent[] {
  return [...commits, ...pulls].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export async function activity(token: string, fullName: string): Promise<ActivityEvent[]> {
  const [commits, pulls] = await Promise.all([
    gh<RawCommit[]>(token, `/repos/${fullName}/commits?per_page=25`),
    gh<RawPull[]>(token, `/repos/${fullName}/pulls?state=all&per_page=25&sort=updated&direction=desc`),
  ]);
  return mergeActivity(commits.map(toCommitEvent), pulls.map(toPullEvent));
}

/** File contents, decoded. Returns null when the path is not in that ref. */
export async function readFile(token: string, fullName: string, path: string, ref?: string): Promise<string | null> {
  try {
    const file = await gh<{ content: string; encoding: string }>(
      token,
      `/repos/${fullName}/contents/${encodeURI(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`
    );
    return file.encoding === "base64" ? atob(file.content.replace(/\n/g, "")) : file.content;
  } catch (error) {
    if (error instanceof GithubError && error.status === 404) return null;
    throw error;
  }
}

export async function defaultBranch(token: string, fullName: string): Promise<string> {
  const repo = await gh<{ default_branch: string }>(token, `/repos/${fullName}`);
  return repo.default_branch;
}

export async function branchHead(token: string, fullName: string, branch: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${fullName}/git/ref/heads/${branch}`);
  return ref.object.sha;
}

export async function createBranch(token: string, fullName: string, branch: string, from: string): Promise<void> {
  const sha = await branchHead(token, fullName, from);
  await gh(token, `/repos/${fullName}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
}

export async function writeFile(
  token: string,
  fullName: string,
  path: string,
  content: string,
  branch: string,
  message: string
): Promise<void> {
  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(token, `/repos/${fullName}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`);
    sha = existing.sha;
  } catch (error) {
    if (!(error instanceof GithubError && error.status === 404)) throw error;
  }
  await gh(token, `/repos/${fullName}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function openPull(
  token: string,
  fullName: string,
  pull: { title: string; head: string; base: string; body: string }
): Promise<{ url: string; number: number }> {
  const created = await gh<{ html_url: string; number: number }>(token, `/repos/${fullName}/pulls`, {
    method: "POST",
    body: JSON.stringify({ ...pull, draft: false }),
  });
  return { url: created.html_url, number: created.number };
}
