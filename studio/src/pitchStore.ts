/**
 * The prospect list, kept in this browser.
 *
 * Honest about its limits: `localStorage` is per browser and per device, it can
 * be cleared by the browser, and it is not a CRM. What it buys is the thing the
 * pitch sheet could not do — a sheet you can come back to, and a list that tells
 * you who to write to next without remembering yourself.
 */

import type { Prospect, ProspectStatus } from "./pitch";

const KEY = "studio:pitch:prospects:v1";
const LIMIT = 60;

/** Storage that never throws: private mode, a full disk, a blocked origin. */
const store = (): Storage | null => {
  try {
    const candidate = globalThis.localStorage;
    if (!candidate) return null;
    const probe = "__studio_probe__";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
};

const isProspect = (value: unknown): value is Prospect => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Prospect>;
  return (
    typeof record.id === "string" &&
    typeof record.url === "string" &&
    typeof record.host === "string" &&
    typeof record.date === "string" &&
    typeof record.score === "number" &&
    typeof record.findings === "number" &&
    typeof record.status === "string" &&
    Boolean(record.sheet)
  );
};

export function loadProspects(): Prospect[] {
  const storage = store();
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProspect).slice(0, LIMIT);
  } catch {
    /* A corrupt list is not worth a broken tab: start again, keep the site. */
    return [];
  }
}

const write = (prospects: Prospect[]): Prospect[] => {
  const kept = prospects.slice(0, LIMIT);
  try {
    store()?.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* out of space, or no storage: the screen still works for this visit */
  }
  return kept;
};

/** Newest first; a re-run of the same site on the same day replaces its sheet. */
export function saveProspect(prospect: Prospect): Prospect[] {
  const existing = loadProspects().filter((entry) => entry.id !== prospect.id);
  const previous = loadProspects().find((entry) => entry.id === prospect.id);
  const merged: Prospect = previous ? { ...prospect, status: previous.status === "new" ? prospect.status : previous.status } : prospect;
  return write([merged, ...existing]);
}

export function setProspectStatus(id: string, status: ProspectStatus): Prospect[] {
  return write(loadProspects().map((entry) => (entry.id === id ? { ...entry, status } : entry)));
}

export function removeProspect(id: string): Prospect[] {
  return write(loadProspects().filter((entry) => entry.id !== id));
}

/** For the tab to say what it is holding, and for tests to start clean. */
export function clearProspects(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
