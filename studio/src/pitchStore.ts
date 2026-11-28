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
/** The file's own name and version, so a restore can tell its own backups from anything else. */
const BACKUP_KIND = "studio-pitch-backup";
const BACKUP_VERSION = 1;
/** A restore is a file someone chose; this is how big a file it may be. */
export const BACKUP_MAX_BYTES = 512 * 1024;

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

/**
 * The list as a file.
 *
 * `localStorage` is one browser: clear the cache and the prospects go with it, and
 * a second device starts from nothing. A backup you can save, mail to yourself and
 * restore is the smallest honest fix — not a database, not a sync, just the list
 * written down somewhere that is not the browser's temporary opinion.
 *
 * The wrapper carries its own name and version so a restore can refuse a file that
 * is not one of these rather than half-reading a stranger's JSON.
 */
export function exportProspects(prospects: Prospect[] = loadProspects()): string {
  return JSON.stringify(
    {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      prospects: prospects.slice(0, LIMIT),
    },
    null,
    2
  );
}

export type ImportResult =
  | { ok: true; added: number; updated: number; prospects: Prospect[] }
  | { ok: false; reason: string };

/** The furthest a prospect has got: a restore must not walk a "won" back to "new". */
const PROGRESS: Record<ProspectStatus, number> = { new: 0, sent: 1, won: 2, lost: 2 };

/**
 * A backup, read back.
 *
 * Merged rather than replaced: restoring yesterday's file onto a list that has
 * moved on since should add what is missing, not delete today's work. Where both
 * sides know a prospect, the newer sheet wins and the *further* status stands —
 * the only thing worse than forgetting who you wrote to is being told you did not.
 */
export function importProspects(text: string, existing: Prospect[] = loadProspects()): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "That file is empty." };
  if (trimmed.length > BACKUP_MAX_BYTES) return { ok: false, reason: "That file is too large to be a backup of sixty prospects." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "That is not JSON — it may be a copy of the sheet rather than a backup file." };
  }

  const record = (parsed ?? {}) as { kind?: unknown; version?: unknown; prospects?: unknown };
  if (record.kind !== BACKUP_KIND) {
    return { ok: false, reason: `That is not a ${BACKUP_KIND} file. Use Back up first, then restore that file.` };
  }
  if (typeof record.version !== "number" || record.version > BACKUP_VERSION) {
    return { ok: false, reason: "That backup was made by a newer Studio than this one. Update the tab and try again." };
  }
  if (!Array.isArray(record.prospects)) return { ok: false, reason: "That backup has no list in it." };

  const incoming = record.prospects.filter(isProspect);
  if (!incoming.length) return { ok: false, reason: "That backup holds no readable prospects." };

  const byId = new Map(existing.map((prospect) => [prospect.id, prospect]));
  const fresh: Prospect[] = [];
  let added = 0;
  let updated = 0;
  for (const prospect of incoming) {
    const previous = byId.get(prospect.id);
    if (!previous) {
      byId.set(prospect.id, prospect);
      fresh.push(prospect);
      added++;
      continue;
    }
    const status = PROGRESS[prospect.status] > PROGRESS[previous.status] ? prospect.status : previous.status;
    byId.set(prospect.id, { ...prospect, status });
    updated++;
  }

  /* Existing order first, then what the backup added — then sorted by date alone.
     Two prospects found on the same day keep the order the person last saw them
     in, rather than being reshuffled alphabetically by a restore. */
  const merged = [...existing.map((prospect) => byId.get(prospect.id)!), ...fresh]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, LIMIT);
  return { ok: true, added, updated, prospects: write(merged) };
}
