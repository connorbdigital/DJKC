export interface Repo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  updatedAt: string;
  language: string | null;
  htmlUrl: string;
}

export interface CommitEvent {
  kind: "commit";
  id: string;
  title: string;
  author: string;
  at: string;
  url: string;
}

export interface PullEvent {
  kind: "pull";
  id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  author: string;
  at: string;
  url: string;
}

export type ActivityEvent = CommitEvent | PullEvent;

export interface FileRef {
  /** Path inside the source project. */
  path: string;
  /** Why it matters, shown in the library. */
  role: string;
  /** true when the file needs hand-editing at the destination (imports, copy). */
  adapt?: boolean;
}

export interface Capability {
  id: string;
  name: string;
  summary: string;
  /** Source project the files are copied from, as owner/name. */
  source: string;
  files: FileRef[];
  env: string[];
  requires: string[];
  /** Steps a human still has to do after the PR lands. */
  manual: string[];
}

export interface DraftedFile {
  path: string;
  content: string;
  note?: string;
}

export interface DraftPlan {
  summary: string;
  steps: string[];
  files: DraftedFile[];
}
