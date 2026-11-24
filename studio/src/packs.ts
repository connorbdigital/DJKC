import type { Capability } from "./types";
import { CAPABILITIES, capabilityById } from "./features";
import { targetPath } from "./paths";

/**
 * Packs are the honest shortcut: several capabilities that belong together,
 * resolved in dependency order and installed as a single pull request. They
 * only ever contain capabilities that already ship in the source project — a
 * pack is a bundle, not a promise.
 */
export interface Pack {
  id: string;
  name: string;
  /** What you get, in one sentence. */
  summary: string;
  /** Capability ids. Order is resolved from `requires`, not from this list. */
  features: string[];
  /** Prerequisites a pull request cannot satisfy. */
  before: string[];
}

export const PACKS: Pack[] = [
  {
    id: "new-site",
    name: "Start a new site",
    summary:
      "A site that can take bookings: storage, the priced enquiry form with Stripe deposits, email alerts, a booking chat, the phone-only booking bar and crawlable static pages.",
    features: [
      "storage-kv",
      "booking-form-deposits",
      "notifications",
      "booking-chat",
      "sticky-cta-bar",
      "static-seo-pages",
    ],
    before: [
      "Start from a Vite + React + TypeScript project with an api/ folder — this pack adds features to that shell, it does not scaffold one",
      "Replace the pricing constants in the copied data file with this project's own before the form goes live",
    ],
  },
  {
    id: "bookings-desk",
    name: "Take bookings and run them",
    summary:
      "The whole booking loop: priced form with deposits, email alerts, a token-gated desk, blocked dates and a subscribe-able calendar feed.",
    features: [
      "storage-kv",
      "booking-form-deposits",
      "notifications",
      "booking-desk",
      "blocked-dates",
      "calendar-feed",
    ],
    before: [
      "Create a KV store in Vercel and connect it to the project",
      "Have a booking address ready for NOTIFY_EMAIL and a verified sending domain for Resend",
    ],
  },
  {
    id: "list-and-desk",
    name: "Mailing list and a desk",
    summary:
      "A sign-up endpoint with rate limiting, CSV export and GDPR deletes, plus the token-gated desk to read, search and remove subscribers.",
    features: ["storage-kv", "mailing-list", "booking-desk"],
    before: [
      "Create a KV store in Vercel and connect it to the project",
      "Decide where the list lives long-term — a provider with unsubscribe links is the honest answer",
    ],
  },
];

export const packById = (id: string) => PACKS.find((pack) => pack.id === id);

export class PackError extends Error {}

/**
 * Dependency-first order. A pack must be self-contained: if a member needs a
 * capability the pack does not carry, that is an error, not a surprise in the
 * pull request.
 */
export function resolvePack(pack: Pack): Capability[] {
  const members = pack.features.map((id) => {
    const capability = capabilityById(id);
    if (!capability) throw new PackError(`Pack "${pack.id}" lists a capability that does not exist: ${id}.`);
    return capability;
  });

  const ids = new Set(members.map((capability) => capability.id));
  const external = new Set<string>();
  for (const capability of members) {
    for (const requirement of capability.requires) {
      if (requirement === "storage") continue;
      if (!ids.has(requirement)) external.add(`${capability.id} needs ${requirement}`);
    }
  }
  if (external.size) {
    throw new PackError(`Pack "${pack.id}" is missing a dependency: ${[...external].join("; ")}.`);
  }

  const ordered: Capability[] = [];
  const done = new Set<string>();
  const remaining = [...members];
  while (remaining.length) {
    const index = remaining.findIndex((capability) =>
      capability.requires.filter((requirement) => requirement !== "storage").every((requirement) => done.has(requirement))
    );
    if (index === -1) {
      throw new PackError(`Pack "${pack.id}" has a dependency loop: ${remaining.map((c) => c.id).join(", ")}.`);
    }
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    ordered.push(next);
    done.add(next.id);
  }
  return ordered;
}

export interface PlannedFile {
  /** Path in the source project. */
  path: string;
  /** Source project for this file, as owner/name. */
  source: string;
  /** Path in the target project, prefix applied. */
  destination: string;
  /** Every capability that brings this file; more than one means it is shared. */
  from: string[];
}

/** Every file the pack writes, once each, in a stable order. */
export function planFiles(capabilities: Capability[], prefix: string): PlannedFile[] {
  const byDestination = new Map<string, PlannedFile>();
  for (const capability of capabilities) {
    for (const file of capability.files) {
      const destination = targetPath(prefix, file.path);
      const existing = byDestination.get(destination);
      if (existing) {
        if (!existing.from.includes(capability.id)) existing.from.push(capability.id);
        continue;
      }
      byDestination.set(destination, {
        path: file.path,
        source: capability.source,
        destination,
        from: [capability.id],
      });
    }
  }
  return [...byDestination.values()];
}

/** Files more than one capability carries — worth saying out loud in the PR. */
export const sharedFiles = (files: PlannedFile[]) => files.filter((file) => file.from.length > 1);

export interface PackExpectation {
  /** Destination path in the target project. */
  path: string;
  role: string;
  /** True when another member of the pack writes this file anyway. */
  internal: boolean;
}

/** Files the pack reads but does not bring, marked when the pack brings them after all. */
export function packExpects(capabilities: Capability[], prefix = ""): PackExpectation[] {
  const written = new Set(planFiles(capabilities, prefix).map((file) => file.destination));
  const seen = new Map<string, PackExpectation>();
  for (const capability of capabilities) {
    for (const file of capability.expects) {
      const destination = targetPath(prefix, file.path);
      if (seen.has(destination)) continue;
      seen.set(destination, { path: destination, role: file.role, internal: written.has(destination) });
    }
  }
  return [...seen.values()];
}

/** The union of a pack's environment variables, in first-seen order. */
export function packEnv(capabilities: Capability[]): string[] {
  const seen = new Set<string>();
  for (const capability of capabilities) for (const name of capability.env) seen.add(name);
  return [...seen];
}

/** The union of everything a human still has to do, deduped. */
export function packManual(capabilities: Capability[]): string[] {
  const seen = new Set<string>();
  for (const capability of capabilities) for (const line of capability.manual) seen.add(line);
  return [...seen];
}

/** Source projects a pack reads from, deduped. */
export const packSources = (capabilities: Capability[]): string[] => [...new Set(capabilities.map((c) => c.source))];

/** A pack whose members are all present in a manifest's feature ids. */
export function packInstalled(pack: Pack, present: string[]): boolean {
  return pack.features.every((id) => present.includes(id));
}

export const capabilityName = (id: string) => CAPABILITIES.find((entry) => entry.id === id)?.name ?? id;
