import type { Capability } from "./types";
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

export function installBody(capability: Capability, opts: { source: string; prefix: string; paths: string[] }): string {
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
    body: installBody(capability, { source: capability.source, prefix, paths }),
  });
  step(`Opened #${pull.number}`);
  return { branch, pullUrl: pull.url, pullNumber: pull.number, paths, skipped };
}
