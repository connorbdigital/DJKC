import type { Capability, FileRef, InstalledFeature, StudioManifest } from "./types";
import { CAPABILITIES } from "./features";
import { createBranch, defaultBranch, headCommit, openPull, readFile, writeFile } from "./github";
import { branchName, packBranchName, targetPath } from "./paths";
import type { Pack, PlannedFile } from "./packs";
import { packEnv, packExpects, packManual, packSources, planFiles, resolvePack, sharedFiles } from "./packs";

export const MANIFEST_PATH = "studio/features.json";

/** Reads whatever the target already records; missing or broken counts as empty. */
export function parseManifest(text: string | null): StudioManifest {
  if (!text) return { version: 1, features: [] };
  try {
    const raw = JSON.parse(text) as Partial<StudioManifest>;
    const features = Array.isArray(raw.features) ? (raw.features as InstalledFeature[]) : [];
    return { version: 1, features: features.filter((entry) => entry && typeof entry.id === "string") };
  } catch {
    return { version: 1, features: [] };
  }
}

/** Adds or replaces features in the manifest in one write, sorted for a clean diff. */
export function mergeManifestMany(existing: string | null, entries: InstalledFeature[]): string {
  const manifest = parseManifest(existing);
  const latest = new Map(entries.map((entry) => [entry.id, entry]));
  const replaced = new Set(latest.keys());
  const features = [...manifest.features.filter((feature) => !replaced.has(feature.id)), ...latest.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  return `${JSON.stringify({ version: 1, features }, null, 2)}\n`;
}

/** Adds or replaces one feature in the manifest and returns the file to write. */
export const mergeManifest = (existing: string | null, entry: InstalledFeature): string =>
  mergeManifestMany(existing, [entry]);

export { branchName, targetPath } from "./paths";

/** Relative import specifiers in a source file — what will break if it is copied alone. */
export function extractImports(content: string): string[] {
  const found = new Set<string>();
  const pattern = /(?:from\s*|import\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    const specifier = match[1];
    if (specifier) found.add(specifier);
  }
  return [...found];
}

/** Turns "src/components/Booking.tsx" + "../data" into candidate repo paths. */
export function resolveImport(fromPath: string, specifier: string): string[] {
  const baseParts = fromPath.split("/").slice(0, -1);
  const parts = [...baseParts];
  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  const joined = parts.join("/");
  const withoutExtension = joined.replace(/\.(tsx|ts|jsx|js|mts|css)$/, "");
  const candidates = [joined];
  for (const extension of [".ts", ".tsx", ".js", ".css", ".mts"]) candidates.push(`${withoutExtension}${extension}`);
  for (const extension of [".ts", ".tsx", ".js"]) candidates.push(`${withoutExtension}/index${extension}`);
  return [...new Set(candidates)];
}

export interface Preflight {
  files: { source: string; destination: string; bytes: number; exists: boolean }[];
  collisions: string[];
  unresolved: { file: string; specifier: string }[];
  missingDependencies: string[];
  /** Files the feature reads but does not write, and the target does not have. */
  missingExpectations: string[];
}

export interface BundleFile {
  /** Project the file is read from, as owner/name. */
  source: string;
  path: string;
}

/**
 * Reads the target before writing anything: is this going to land cleanly?
 * Works for one capability or a whole pack — `bundled` names the capabilities
 * whose files are already inside this write, so their needs are satisfied.
 */
export async function preflightBundle(opts: {
  token: string;
  files: BundleFile[];
  requires: string[];
  target: string;
  prefix: string;
  /** Capabilities whose files are part of this write. */
  bundled?: string[];
  /** Files this feature reads but never writes. */
  expects?: FileRef[];
  /** Destinations this write creates, so an expectation met here is not missing. */
  provided?: string[];
}): Promise<Preflight> {
  const { token, target, prefix } = opts;
  const files: Preflight["files"] = [];
  const contents = new Map<string, string>();
  const collisions: string[] = [];

  for (const file of opts.files) {
    const content = await readFile(token, file.source, file.path);
    if (content === null) continue;
    if (contents.has(file.path)) continue;
    contents.set(file.path, content);
    const destination = targetPath(prefix, file.path);
    const existing = await readFile(token, target, destination);
    if (existing !== null) collisions.push(destination);
    files.push({ source: file.path, destination, bytes: content.length, exists: existing !== null });
  }

  const normalise = (path: string) => path.replace(/\.(tsx|ts|jsx|js|mts|css)$/, "");
  const bundled = new Set([...contents.keys()].map(normalise));
  const unresolved: Preflight["unresolved"] = [];
  for (const [path, content] of contents) {
    for (const specifier of extractImports(content)) {
      const candidates = resolveImport(path, specifier);
      /* `./store.js` and `./store.ts` are the same file to a bundler. */
      const insideBundle = candidates.some((candidate) => bundled.has(normalise(candidate)));
      if (insideBundle) continue;
      let found = false;
      for (const candidate of candidates) {
        if (await readFile(token, target, targetPath(prefix, candidate)) !== null) { found = true; break; }
        if (await readFile(token, target, candidate) !== null) { found = true; break; }
      }
      if (!found) unresolved.push({ file: path, specifier });
    }
  }

  const provided = new Set([...(opts.provided ?? []), ...files.map((file) => file.destination)]);
  const missingExpectations: string[] = [];
  for (const expectation of opts.expects ?? []) {
    const destination = targetPath(prefix, expectation.path);
    if (provided.has(destination)) continue;
    if ((await readFile(token, target, destination)) !== null) continue;
    missingExpectations.push(`${destination} — ${expectation.role}`);
  }

  const inside = new Set(opts.bundled ?? []);
  const missingDependencies: string[] = [];
  for (const id of opts.requires) {
    if (id === "storage" || inside.has(id)) continue;
    const dependency = CAPABILITIES.find((entry) => entry.id === id);
    if (!dependency) continue;
    let present = false;
    for (const file of dependency.files) {
      if (await readFile(token, target, targetPath(prefix, file.path)) !== null) { present = true; break; }
    }
    if (!present) missingDependencies.push(id);
  }

  return { files, collisions, unresolved, missingDependencies, missingExpectations };
}

/** Reads the target before writing anything: is this going to land cleanly? */
export const preflight = (opts: {
  token: string;
  capability: Capability;
  target: string;
  prefix: string;
}): Promise<Preflight> =>
  preflightBundle({
    token: opts.token,
    files: opts.capability.files.map((file) => ({ source: opts.capability.source, path: file.path })),
    requires: opts.capability.requires,
    target: opts.target,
    prefix: opts.prefix,
    expects: opts.capability.expects,
  });

/** The same check for a whole pack: internal dependencies count as satisfied. */
export function preflightPack(opts: {
  token: string;
  pack: Pack;
  target: string;
  prefix: string;
}): Promise<Preflight> {
  const capabilities = resolvePack(opts.pack);
  const requires = [...new Set(capabilities.flatMap((capability) => capability.requires))];
  return preflightBundle({
    token: opts.token,
    files: planFiles(capabilities, opts.prefix).map((file) => ({ source: file.source, path: file.path })),
    requires,
    target: opts.target,
    prefix: opts.prefix,
    bundled: capabilities.map((capability) => capability.id),
    expects: capabilities.flatMap((capability) => capability.expects),
    provided: planFiles(capabilities, opts.prefix).map((file) => file.destination),
  });
}

export function installBody(
  capability: Capability,
  opts: { source: string; prefix: string; paths: string[]; preflight?: Preflight; sourceCommit?: string }
): string {
  const lines = [
    `Adds **${capability.name}** to this project.`,
    "",
    capability.summary,
    "",
    `Copied from \`${opts.source}\`${opts.sourceCommit ? ` at \`${opts.sourceCommit.slice(0, 7)}\`` : ""}${opts.prefix ? ` into \`${opts.prefix}/\`` : ""}. Nothing was modified in transit — the files are byte-for-byte what already ships there.`,
    "",
    `Version \`${capability.version}\`. The install is recorded in \`${MANIFEST_PATH}\`, so this project knows what it has, where it came from, and which commit to compare against later.`,
    "",
    "## Files",
    ...opts.paths.map((p) => `- \`${p}\``),
    "",
  ];

  if (opts.preflight) {
    const { collisions, unresolved, missingDependencies, missingExpectations } = opts.preflight;
    if (collisions.length || unresolved.length || missingDependencies.length || missingExpectations.length) {
      lines.push("## Checked before writing", "");
      if (collisions.length) lines.push(...collisions.map((path) => `- Overwrote an existing file: \`${path}\``));
      if (unresolved.length) {
        lines.push(...unresolved.map((entry) => `- \`${entry.file}\` imports \`${entry.specifier}\` — not present in the target yet`));
      }
      if (missingDependencies.length) {
        lines.push(...missingDependencies.map((id) => `- Depends on the \`${id}\` capability, which is not in this project`));
      }
      if (missingExpectations.length) {
        lines.push(...missingExpectations.map((line) => `- Expects \`${line}\`, which this project does not have yet`));
      }
      lines.push("");
    }
  }

  if (capability.expects.length) {
    lines.push(
      "## Reads from your project",
      ...capability.expects.map((file) => `- \`${targetPath(opts.prefix, file.path)}\` — ${file.role}`),
      ""
    );
  }

  const adapt = capability.files.filter((f) => f.adapt);
  if (adapt.length) {
    lines.push(
      "## Needs editing after merge",
      ...adapt.map((f) => `- \`${targetPath(opts.prefix, f.path)}\` — ${f.role}`),
      ""
    );
  }
  if (capability.env.length) lines.push("## Environment variables", ...capability.env.map((e) => `- \`${e}\``), "");
  if (capability.requires.length) lines.push("## Depends on", ...capability.requires.map((r) => `- \`${r}\` (install it too if it is not already here)`), "");
  if (capability.manual.length) lines.push("## Still to do by hand", ...capability.manual.map((m) => `- ${m}`), "");
  lines.push(
    "---",
    "Opened by Studio from the feature library. Files were copied as-is; tests in the source project passed before this was shipped there.",
    "Do not merge until the edits above are done and this project's build is green."
  );
  return lines.join("\n");
}

export interface InstallResult {
  branch: string;
  pullUrl: string;
  pullNumber: number;
  paths: string[];
  skipped: string[];
}

export async function installFeature(opts: {
  token: string;
  capability: Capability;
  target: string;
  prefix: string;
  preflight?: Preflight;
  onStep?: (message: string) => void;
}): Promise<InstallResult> {
  const { token, capability, target, prefix } = opts;
  const step = opts.onStep ?? (() => {});
  const base = await defaultBranch(token, target);
  const branch = branchName(capability.id, new Date());
  const sourceBranch = await defaultBranch(token, capability.source);
  const sourceCommit = await headCommit(token, capability.source, sourceBranch);
  step(`Pinning to ${capability.source}@${sourceCommit.slice(0, 7)}`);

  step(`Creating ${branch} from ${base}`);
  await createBranch(token, target, branch, base);

  const paths: string[] = [];
  const skipped: string[] = [];
  for (const file of capability.files) {
    const content = await readFile(token, capability.source, file.path, sourceBranch);
    if (content === null) {
      skipped.push(file.path);
      continue;
    }
    const destination = targetPath(prefix, file.path);
    step(`Writing ${destination}`);
    await writeFile(token, target, destination, content, branch, `Add ${file.path} from ${capability.id}`);
    paths.push(destination);
  }

  if (!paths.length) throw new Error(`None of ${capability.id}'s files could be read from ${capability.source}.`);

  step(`Recording it in ${MANIFEST_PATH}`);
  const manifest = mergeManifest(await readFile(token, target, MANIFEST_PATH, branch), {
    id: capability.id,
    name: capability.name,
    version: capability.version,
    source: capability.source,
    sourceCommit,
    installedAt: new Date().toISOString(),
    files: paths,
  });
  await writeFile(token, target, MANIFEST_PATH, manifest, branch, `Record ${capability.id} in the studio manifest`);

  step("Opening the pull request");
  const pull = await openPull(token, target, {
    title: `Studio: add ${capability.name}`,
    head: branch,
    base,
    body: installBody(capability, {
      source: capability.source,
      prefix,
      paths,
      preflight: opts.preflight,
      sourceCommit,
    }),
  });
  step(`Opened #${pull.number}`);
  return { branch, pullUrl: pull.url, pullNumber: pull.number, paths, skipped };
}

export function packBody(
  pack: Pack,
  opts: {
    capabilities: Capability[];
    files: PlannedFile[];
    sources: Record<string, string>;
    paths: string[];
    omitted: string[];
    preflight?: Preflight;
  }
): string {
  const { capabilities, files, sources } = opts;
  const pinned = Object.entries(sources)
    .map(([source, commit]) => `\`${source}\`@\`${commit.slice(0, 7)}\``)
    .join(", ");

  const lines = [
    `Sets up **${pack.name}** in one pull request.`,
    "",
    pack.summary,
    "",
    `Copied from ${pinned}. Files are byte-for-byte what already ships in the source project — nothing was modified in transit.`,
    "",
    "## What lands",
    ...capabilities
      .filter((capability) => !opts.omitted.includes(capability.id))
      .map(
        (capability) =>
          `- **${capability.name}** \`${capability.version}\` — ${capability.files.length} file${capability.files.length === 1 ? "" : "s"}`
      ),
    "",
  ];

  if (opts.omitted.length) {
    lines.push(...opts.omitted.map((id) => `- Could not be read from the source, so it was left out: \`${id}\``), "");
  }

  const shared = sharedFiles(files);
  if (shared.length) {
    lines.push(
      "## Files several features share",
      ...shared.map((file) => `- \`${file.destination}\` — used by ${file.from.join(", ")}`),
      ""
    );
  }

  lines.push("## Files", ...opts.paths.map((path) => `- \`${path}\``), "");

  if (pack.before.length) lines.push("## Before you start", ...pack.before.map((line) => `- ${line}`), "");

  if (opts.preflight) {
    const { collisions, unresolved, missingDependencies, missingExpectations } = opts.preflight;
    if (collisions.length || unresolved.length || missingDependencies.length || missingExpectations.length) {
      lines.push("## Checked before writing", "");
      if (collisions.length) lines.push(...collisions.map((path) => `- Overwrote an existing file: \`${path}\``));
      if (unresolved.length) {
        lines.push(...unresolved.map((entry) => `- \`${entry.file}\` imports \`${entry.specifier}\` — not present in the target yet`));
      }
      if (missingDependencies.length) {
        lines.push(...missingDependencies.map((id) => `- Depends on the \`${id}\` capability, which is not in this project`));
      }
      if (missingExpectations.length) {
        lines.push(...missingExpectations.map((line) => `- Expects \`${line}\`, which this project does not have yet`));
      }
      lines.push("");
    }
  }

  const expected = packExpects(capabilities);
  if (expected.length) {
    lines.push(
      "## Reads from your project",
      ...expected.map(
        (entry) =>
          `- \`${entry.path}\` — ${entry.role}${entry.internal ? " (provided by this pack)" : ""}`
      ),
      ""
    );
  }

  const env = packEnv(capabilities);
  if (env.length) lines.push("## Environment variables", ...env.map((name) => `- \`${name}\``), "");

  const adapt = capabilities.flatMap((capability) =>
    capability.files.filter((file) => file.adapt).map((file) => `- \`${targetPath("", file.path)}\` — ${file.role}`)
  );
  if (adapt.length) lines.push("## Needs editing after merge", ...adapt, "");

  const manual = packManual(capabilities);
  if (manual.length) lines.push("## Still to do by hand", ...manual.map((line) => `- ${line}`), "");

  lines.push(
    "## Recorded in the manifest",
    "",
    `Each feature above is added to \`${MANIFEST_PATH}\` with its version, source and the commit it was read from — so this project knows what it has and what it can be compared against later.`,
    "",
    "---",
    "Opened by Studio from a setup pack. Files were copied as-is; tests in the source project passed before this was shipped there.",
    "Do not merge until the edits above are done and this project's build is green."
  );
  return lines.join("\n");
}

export interface PackInstallResult {
  branch: string;
  pullUrl: string;
  pullNumber: number;
  paths: string[];
  skipped: string[];
  features: string[];
}

/** One branch, one pull request, every file the pack needs. Never a merge. */
export async function installPack(opts: {
  token: string;
  pack: Pack;
  target: string;
  prefix: string;
  preflight?: Preflight;
  onStep?: (message: string) => void;
}): Promise<PackInstallResult> {
  const { token, pack, target, prefix } = opts;
  const step = opts.onStep ?? (() => {});
  const capabilities = resolvePack(pack);
  const files = planFiles(capabilities, prefix);

  const base = await defaultBranch(token, target);
  const sources: Record<string, string> = {};
  for (const source of packSources(capabilities)) {
    const sourceBranch = await defaultBranch(token, source);
    sources[source] = await headCommit(token, source, sourceBranch);
  }
  step(`Pinning to ${Object.entries(sources).map(([source, commit]) => `${source}@${commit.slice(0, 7)}`).join(", ")}`);

  const branch = packBranchName(pack.id, new Date());
  step(`Creating ${branch} from ${base}`);
  await createBranch(token, target, branch, base);

  const written = new Map<string, string[]>();
  const paths: string[] = [];
  const skipped: string[] = [];
  const omitted: string[] = [];

  for (const file of files) {
    const content = await readFile(token, file.source, file.path);
    if (content === null) {
      skipped.push(file.path);
      continue;
    }
    step(`Writing ${file.destination}`);
    await writeFile(token, target, file.destination, content, branch, `Add ${file.path} from the ${pack.id} pack`);
    paths.push(file.destination);
    for (const id of file.from) written.set(id, [...(written.get(id) ?? []), file.destination]);
  }

  for (const capability of capabilities) {
    if (!written.has(capability.id)) omitted.push(capability.id);
  }
  if (!paths.length) throw new Error(`None of the ${pack.id} pack's files could be read from its sources.`);

  const installedAt = new Date().toISOString();
  const entries = capabilities
    .filter((capability) => written.has(capability.id))
    .map((capability) => ({
      id: capability.id,
      name: capability.name,
      version: capability.version,
      source: capability.source,
      sourceCommit: sources[capability.source] ?? "",
      installedAt,
      files: written.get(capability.id) ?? [],
    }));

  step(`Recording ${entries.length} feature${entries.length === 1 ? "" : "s"} in ${MANIFEST_PATH}`);
  const manifest = mergeManifestMany(await readFile(token, target, MANIFEST_PATH, branch), entries);
  await writeFile(token, target, MANIFEST_PATH, manifest, branch, `Record the ${pack.id} pack in the studio manifest`);

  step("Opening the pull request");
  const pull = await openPull(token, target, {
    title: `Studio: ${pack.name}`,
    head: branch,
    base,
    body: packBody(pack, { capabilities, files, sources, paths, omitted, preflight: opts.preflight }),
  });
  step(`Opened #${pull.number}`);
  return { branch, pullUrl: pull.url, pullNumber: pull.number, paths, skipped, features: entries.map((entry) => entry.id) };
}
