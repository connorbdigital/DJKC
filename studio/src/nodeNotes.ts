/**
 * A note pinned to one node in the space: "the deposit is still a stub", "ask KC
 * about the January dates". Stored beside the loose notes, in this browser, and
 * never sent anywhere unless the shelf's sync is asked to.
 */

export const NODE_NOTES_KEY = "atlas:node-notes:v1";
/** Four thousand characters is a note, not a document. */
export const NOTE_LIMIT = 4000;
const MAX_NODES = 500;

export type NodeNotes = Record<string, string>;

export function parseNodeNotes(raw: unknown): NodeNotes {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NodeNotes = {};
  let kept = 0;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= MAX_NODES) break;
    if (typeof value !== "string") continue;
    const text = value.slice(0, NOTE_LIMIT);
    if (!text.trim()) continue;
    out[id] = text;
    kept += 1;
  }
  return out;
}

/** Writing nothing deletes the note: an empty note is not a note. */
export function setNodeNote(notes: NodeNotes, id: string, text: string): NodeNotes {
  const next = { ...notes };
  if (!id) return next;
  if (!text.trim()) {
    delete next[id];
    return next;
  }
  next[id] = text.slice(0, NOTE_LIMIT);
  return next;
}

export function noteCount(notes: NodeNotes): number {
  return Object.values(notes).filter((text) => text.trim()).length;
}

/** Local notes win where both have one; the gist only fills the gaps. */
export function mergeNodeNotes(local: NodeNotes, remote: NodeNotes): NodeNotes {
  const merged: NodeNotes = { ...remote };
  for (const [id, text] of Object.entries(local)) {
    if (text.trim()) merged[id] = text;
  }
  return merged;
}
