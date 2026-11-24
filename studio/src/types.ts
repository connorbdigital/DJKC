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

/**
 * The themes the library is organised by. Small, stable and human: they are
 * how you find a feature when you do not know its name.
 */
export type Category = "bookings" | "operations" | "marketing" | "design" | "search" | "storage";

export interface Capability {
  id: string;
  name: string;
  /** Bumped by hand when the files change; recorded in the target's manifest. */
  version: string;
  summary: string;
  /** Which shelf it belongs on. */
  category: Category;
  /** Source project the files are copied from, as owner/name. */
  source: string;
  files: FileRef[];
  /**
   * Files this feature reads but never writes — your own content, or another
   * feature's files. Listed so the pull request can say what is still missing.
   */
  expects: FileRef[];
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

export interface InstalledFeature {
  id: string;
  name: string;
  version: string;
  source: string;
  /** Commit the files were read from, so an install can be reproduced. */
  sourceCommit: string;
  installedAt: string;
  files: string[];
}

export interface StudioManifest {
  version: 1;
  features: InstalledFeature[];
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
}
