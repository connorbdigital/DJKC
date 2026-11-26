/**
 * The inventory read at build time, and what to say when there is none.
 *
 * `scripts/scan-anything.mts` writes `src/generated/anythingScan.json` during the
 * build, where the key is. The spaces start from it, so a visitor sees every app
 * and every part before the first request leaves the page — and still sees them on
 * a day the API is down.
 *
 * The file is generated, not committed: a fresh checkout has no scan, and the
 * fallback below is what the spaces say in that case.
 */
import type { AnythingApp } from "./anythingClient";

export interface ScanFile {
  scannedAt: string;
  ok: boolean;
  reason?: string;
  apps: {
    id: string;
    name: string;
    organizationName: string;
    platform: string;
    modules: string[];
    moduleCount?: number;
    url?: string;
    updatedAt: string;
  }[];
  counts: { projects: number; parts: number; unread: number };
  me?: { name: string; email: string; credits: number | null } | null;
}

const FALLBACK: ScanFile = {
  scannedAt: new Date(0).toISOString(),
  ok: false,
  reason: "This build has no Anything scan in it.",
  apps: [],
  counts: { projects: 0, parts: 0, unread: 0 },
  me: null,
};

/* `import.meta.glob` rather than a plain import: the file is written by the build
   before Vite runs, but a test, a type-check or a fresh clone has no such file,
   and an import that must exist makes every one of those a build failure. */
const found = import.meta.glob("./generated/anythingScan.json", { eager: true, import: "default" }) as Record<
  string,
  ScanFile
>;

export const scan: ScanFile = found["./generated/anythingScan.json"] ?? FALLBACK;

/** A scan file as the spaces want it: apps with their parts, or nothing at all. */
export function toApps(file: ScanFile): AnythingApp[] {
  if (!file.ok) return [];
  return file.apps.map((app) => ({
    id: app.id,
    name: app.name,
    organizationName: app.organizationName,
    platform: app.platform,
    modules: app.modules,
    moduleCount: app.moduleCount ?? app.modules.length,
    ...(app.url ? { url: app.url } : {}),
    updatedAt: app.updatedAt,
  }));
}

/** One line for the space: what the scan read, or why it read nothing. */
export function describeScan(file: ScanFile): string {
  if (!file.ok) return file.reason ? `Not scanned at build: ${file.reason}` : "Not scanned at build.";
  const when = new Date(file.scannedAt);
  const stamp = Number.isNaN(when.getTime())
    ? "at build"
    : `on ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const parts = `${file.counts.parts} part${file.counts.parts === 1 ? "" : "s"}`;
  const apps = `${file.counts.projects} app${file.counts.projects === 1 ? "" : "s"}`;
  return `Read at build ${stamp}: ${apps}, ${parts}${file.counts.unread ? `, ${file.counts.unread} unread` : ""}.`;
}

export const scannedApps: AnythingApp[] = toApps(scan);

export const scanLine = (): string => describeScan(scan);
