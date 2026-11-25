/**
 * Notes that follow you to another device, without a database.
 *
 * The notes live in a **secret gist** on your own GitHub account. A gist is
 * private-by-link, versioned, and needs nothing deployed; the token you already
 * use for the Studio can read and write it if it carries the `gist` scope. When
 * it does not, GitHub says so and this module passes the sentence through
 * instead of pretending the sync worked.
 *
 * Push and pull are separate on purpose: a whole free-text note cannot be merged
 * line by line without inventing an author, so the choice stays yours.
 */

import { parseNodeNotes, mergeNodeNotes, type NodeNotes } from "./nodeNotes";

export const GIST_FILENAME = "atlas-notes.json";
export const GIST_STORE_KEY = "atlas:notes-gist";
const API = "https://api.github.com";

export interface NoteBundle {
  version: 1;
  notes: string;
  nodeNotes: NodeNotes;
  updatedAt: string;
}

export function buildBundle(notes: string, nodeNotes: NodeNotes, updatedAt = new Date().toISOString()): NoteBundle {
  return { version: 1, notes, nodeNotes, updatedAt };
}

/** The file body: pretty enough to read in a gist, strict enough to parse back. */
export function serialiseBundle(bundle: NoteBundle): string {
  return `${JSON.stringify({ ...bundle, nodeNotes: parseNodeNotes(bundle.nodeNotes) }, null, 2)}\n`;
}

export function parseBundle(raw: string | null | undefined): NoteBundle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NoteBundle>;
    if (!parsed || typeof parsed !== "object") return null;
    const notes = typeof parsed.notes === "string" ? parsed.notes : "";
    const nodeNotes = parseNodeNotes(parsed.nodeNotes);
    if (!notes.trim() && !Object.keys(nodeNotes).length) return null;
    return {
      version: 1,
      notes,
      nodeNotes,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

/** One line for the notes sheet: what came back, and when it was written. */
export function describeBundle(bundle: NoteBundle): string {
  const pinned = Object.keys(bundle.nodeNotes).length;
  const when = bundle.updatedAt ? new Date(bundle.updatedAt) : null;
  const stamp = when && !Number.isNaN(when.getTime()) ? `at ${when.toLocaleString("en-GB")}` : "at an unknown time";
  return `${pinned} pinned note${pinned === 1 ? "" : "s"} and ${bundle.notes.trim().length} characters, saved ${stamp}`;
}

/** Pulling never throws away what is on this device: local notes win, gaps fill. */
export function mergeBundle(local: NoteBundle, remote: NoteBundle): NoteBundle {
  return {
    version: 1,
    notes: local.notes.trim() ? local.notes : remote.notes,
    nodeNotes: mergeNodeNotes(local.nodeNotes, remote.nodeNotes),
    updatedAt: remote.updatedAt || local.updatedAt,
  };
}

export function isGistId(value: string): boolean {
  return /^[a-f0-9]{20,40}$/i.test(value.trim());
}

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
});

export interface SyncResult {
  ok: boolean;
  error?: string;
  gistId?: string;
  bundle?: NoteBundle;
}

const failure = async (response: Response): Promise<string> => {
  if (response.status === 401) return "GitHub refused the token (401). Sign in again.";
  if (response.status === 403) return "That token cannot write gists — add the `gist` scope to it (403).";
  if (response.status === 404) return "That gist is gone, or the token cannot see it (404).";
  if (response.status === 422) return "GitHub would not take the gist (422).";
  const text = await response.text().catch(() => "");
  return `GitHub said ${response.status}${text ? `: ${text.slice(0, 140)}` : ""}.`;
};

export async function pushNotes(token: string, bundle: NoteBundle, gistId: string | null, signal?: AbortSignal): Promise<SyncResult> {
  const body = { description: "Atlas notes — a private copy for syncing", public: false, files: { [GIST_FILENAME]: { content: serialiseBundle(bundle) } } };
  const url = gistId ? `${API}/gists/${gistId}` : `${API}/gists`;
  try {
    const response = await fetch(url, {
      method: gistId ? "PATCH" : "POST",
      headers: headers(token),
      body: JSON.stringify(gistId ? { files: body.files } : body),
      signal,
    });
    if (!response.ok) return { ok: false, error: await failure(response) };
    const json = (await response.json()) as { id?: string };
    return { ok: true, gistId: json.id ?? gistId ?? undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The request failed." };
  }
}

export async function pullNotes(token: string, gistId: string, signal?: AbortSignal): Promise<SyncResult> {
  try {
    const response = await fetch(`${API}/gists/${gistId}`, { headers: headers(token), signal });
    if (!response.ok) return { ok: false, error: await failure(response) };
    const json = (await response.json()) as { files?: Record<string, { content?: string; truncated?: boolean }> };
    const file = json.files?.[GIST_FILENAME];
    if (!file?.content) return { ok: false, error: `That gist has no ${GIST_FILENAME} in it.` };
    if (file.truncated) return { ok: false, error: "That file is too big for GitHub to return in one piece." };
    const remote = parseBundle(file.content);
    if (!remote) return { ok: false, error: "That gist has a file by the right name but nothing readable inside it." };
    return { ok: true, gistId, bundle: remote };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The request failed." };
  }
}
