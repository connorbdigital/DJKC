import type { Capability } from "./types";
import { CAPABILITIES } from "./features";
import { createBranch, defaultBranch, openPull, readFile, writeFile } from "./github";

/** Where a capability's file lands in the target repo. */
export function targetPath(prefix: string, sourcePath: string): string {
  const clean = prefix.trim().replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/${sourcePath}` : sourcePath;
}

/** studio/feature-booking-form-deposits-2026-11-24-0530 */
export function branchName(capabilityId: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `studio/feature-${capabilityId}-${stamp}`;
}

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
}

/** Reads the target before writing anything: is this going to land cleanly? */
export async function preflight(opts: {
  token: string;
  capability: Capability;
  target: string;
  prefix: string;
}): Promise<Preflight> {
  const { token, capability, target, prefix } = opts;
  const files: Preflight["files"] = [];
  const contents = new Map<string, string>();
  const collisions: string[] = [];

  for (const file of capability.files) {
    const content = await readFile(token, capability.source, file.path);
    if (content === null) continue;
    contents.set(file.path, content);
    const destination = targetPath(prefix, file.path);
    const existing = await readFile(token, target, destination);
    if (existing !== null) collisions.push(destination);
    files.push({ source: file.path, destination, bytes: content.length, exists: existing !== null });
  }

  const bundled = new Set([...contents.keys()].map((path) => path.replace(/\.(tsx|ts|jsx|js|mts|css)$/, "")));
  const unresolved: Preflight["unresolved"] = [];
  for (const [path, content] of contents) {
    for (const specifier of extractImports(content)) {
      const candidates = resolveImport(path, specifier);
      const insideBundle = candidates.some((candidate) => bundled.has(candidate));
      if (insideBundle) continue;
      let found = false;
      for (const candidate of candidates) {
        if (await readFile(token, target, targetPath(prefix, candidate)) !== null) { found = true; break; }
        if (await readFile(token, target, candidate) !== null) { found = true; break; }
      }
      if (!found) unresolved.push({ file: path, specifier });
    }
  }

  const missingDependencies: string[] = [];
  for (const id of capability.requires) {
    if (id === "storage") continue;
    const dependency = CAPABILITIES.find((entry) => entry.id === id);
    if (!dependency) continue;
    let present = false;
    for (const file of dependency.files) {
      if (await readFile(token, target, targetPath(prefix, file.path)) !== null) { present = true; break; }
    }
    if (!present) missingDependencies.push(id);
  }

  return { files, collisions, unresolved, missingDependencies };
}

export function installBody(capability: Capability, opts: { source: string; prefix: string; paths: string[]; preflight?: Preflight }): string {
  const lines = [
    `Adds **${capability.name}** to this project.`,
    "",
    capability.summary,
    "",
    `Copied from \`${opts.source}\`${opts.prefix ? ` into \`${opts.prefix}/\`` : ""}. Nothing was modified in transit — the files are byte-for-byte what already ships there.`,
    "",
    "## Files",
    ...opts.paths.map((p) => `- \`${p}\``),
    "",
  ];

  if (opts.preflight) {
    const { collisions, unresolved, missingDependencies } = opts.preflight;
    if (collisions.length || unresolved.length || missingDependencies.length) {
      lines.push("## Checked before writing", "");
      if (collisions.length) lines.push(...collisions.map((path) => `- Overwrote an existing file: \`${path}\``));
      if (unresolved.length) {
        lines.push(...unresolved.map((entry) => `- \`${entry.file}\` imports \`${entry.specifier}\` — not present in the target yet`));
      }
      if (missingDependencies.length) {
        lines.push(...missingDependencies.map((id) => `- Depends on the \`${id}\` capability, which is not in this project`));
      }
      lines.push("");
    }
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

  step(`Creating ${branch} from ${base}`);
  await createBranch(token, target, branch, base);

  const paths: string[] = [];
  const skipped: string[] = [];
  for (const file of capability.files) {
    const content = await readFile(token, capability.source, file.path, base === "main" ? "main" : undefined);
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

  step("Opening the pull request");
  const pull = await openPull(token, target, {
    title: `Studio: add ${capability.name}`,
    head: branch,
    base,
    body: installBody(capability, { source: capability.source, prefix, paths, preflight: opts.preflight }),
  });
  step(`Opened #${pull.number}`);
  return { branch, pullUrl: pull.url, pullNumber: pull.number, paths, skipped };
}
