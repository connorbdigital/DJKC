import { CAPABILITIES, CATEGORIES, inCategory } from "./features";

/**
 * The process catalogue.
 *
 * The library says what a feature *is*. This says why it exists: the argument
 * for it, and the specific thing that goes wrong without it. It is generated
 * from the same array the installer uses, so the document cannot drift away
 * from what the builder would actually copy.
 */

export interface BuilderStep {
  id: string;
  name: string;
  does: string;
  why: string;
}

/**
 * The builder's own pipeline — the processes you go through to put a feature
 * into a project. Same treatment as the features: what it does, why it exists.
 */
export const BUILDER_STEPS: BuilderStep[] = [
  {
    id: "inventory",
    name: "Take inventory",
    does: "Reads a project's file tree, package.json, routes, tests and features.json, then reports what is actually in it.",
    why: "You cannot install into a project you have not read. Without this, the first pull request collides with files that already exist and the installer looks careless.",
  },
  {
    id: "preflight",
    name: "Preflight against the target",
    does: "Reads the target's current files, flags collisions, missing dependencies, missing expected files, and relative imports that would not resolve after the copy.",
    why: "A copy that compiles in the source project and not in the target is the normal failure. Catching it before the branch exists is the difference between a review and a repair job.",
  },
  {
    id: "draft",
    name: "Draft the files",
    does: "Copies the listed files byte-for-byte from the source project, rewriting relative imports for the destination folder.",
    why: "Byte-for-byte keeps the copy honest: what lands is what was tested in the source repo, with the minimum edits needed to resolve imports.",
  },
  {
    id: "pull-request",
    name: "Open a pull request",
    does: "Creates a branch, commits the files, and opens a PR whose body lists what still needs editing by hand.",
    why: "Nothing merges itself. The PR is where a human sees the file list, the environment variables and the manual steps before anything reaches production.",
  },
  {
    id: "checks",
    name: "Watch the checks",
    does: "Polls the PR's check runs and reports pass, fail or still running, with a link to the failing job.",
    why: "A green PR is the only signal that the copied code builds in the target's own CI, not just in the source project.",
  },
  {
    id: "gate",
    name: "The gate",
    does: "Blocks the installer until a token with the right scopes is present, and refuses to touch a repository outside the account it is given.",
    why: "The builder writes to real repositories. The gate is what stops a mistyped target or an under-scoped token from producing a confusing half-install.",
  },
  {
    id: "site-check",
    name: "Site check",
    does: "Fetches a public page and reports title, description, headings, word count, images without alt text, structured data and robots/sitemap presence.",
    why: "The catalogue is only as good as its evidence. This is how a claim like 'crawlable pages' gets checked against a real URL instead of assumed.",
  },
  {
    id: "code-search",
    name: "Cross-project code search",
    does: "Runs GitHub code search scoped to one account or repository, groups hits by file, and highlights the matching fragment.",
    why: "Before writing a feature, you check whether it already exists somewhere. Without it, the same sign-up form gets written three times in three repos.",
  },
];

const shelfOrder = CATEGORIES.map((category) => category.id);

export function processDocMarkdown(): string {
  const lines: string[] = [];
  lines.push("# The process catalogue");
  lines.push("");
  lines.push(
    `${CAPABILITIES.length} processes on ${CATEGORIES.length} shelves, and ${BUILDER_STEPS.length} steps the builder itself runs. ` +
      "Each entry says what it does, why the site needs it, and what specifically breaks without it."
  );
  lines.push("");
  lines.push("Generated from `studio/src/features.ts` — run `npm run processes` after changing the library.");
  lines.push("");
  lines.push("## Contents");
  lines.push("");
  const anchor = (label: string) => label.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const category of CATEGORIES) {
    const count = inCategory(category.id).length;
    lines.push(`- [${category.label}](#${anchor(category.label)}) — ${count} process${count === 1 ? "" : "es"}`);
  }
  lines.push(`- [How the builder works](#how-the-builder-works) — ${BUILDER_STEPS.length} steps`);
  lines.push("- [Dependencies](#dependencies)");

  for (const category of CATEGORIES) {
    lines.push(`## ${category.label}`);
    lines.push("");
    lines.push(`_${category.why}_`);
    lines.push("");
    for (const capability of inCategory(category.id)) {
      lines.push(`### ${capability.name}`);
      lines.push("");
      lines.push(`**What it does.** ${capability.summary}`);
      lines.push("");
      lines.push(`**Why the site needs it.** ${capability.why}`);
      lines.push("");
      lines.push(`**What breaks without it.** ${capability.without}`);
      lines.push("");
      lines.push(`- Version: ${capability.version} · source: \`${capability.source}\``);
      lines.push(
        `- Files: ${capability.files.map((file) => `\`${file.path}\`${file.adapt ? " (needs editing)" : ""}`).join(", ")}`
      );
      if (capability.env.length) lines.push(`- Environment: ${capability.env.map((name) => `\`${name}\``).join(", ")}`);
      if (capability.requires.length) lines.push(`- Install after: ${capability.requires.join(", ")}`);
      if (capability.manual.length) lines.push(`- By hand: ${capability.manual.join("; ")}`);
      lines.push("");
    }
  }

  lines.push("## How the builder works");
  lines.push("");
  lines.push("The steps above install a process. These are the steps the builder runs on itself.");
  lines.push("");
  for (const step of BUILDER_STEPS) {
    lines.push(`### ${step.name}`);
    lines.push("");
    lines.push(`**What it does.** ${step.does}`);
    lines.push("");
    lines.push(`**Why it exists.** ${step.why}`);
    lines.push("");
  }

  lines.push("## Dependencies");
  lines.push("");
  const roots = CAPABILITIES.filter((capability) => capability.requires.length === 0).map((capability) => capability.id);
  lines.push(`Nothing has to be installed before: ${roots.map((id) => `\`${id}\``).join(", ")}.`);
  lines.push("");
  for (const capability of CAPABILITIES.filter((entry) => entry.requires.length > 0)) {
    lines.push(`- \`${capability.id}\` needs ${capability.requires.map((id) => `\`${id}\``).join(", ")} first`);
  }
  lines.push("");
  lines.push("Every dependency is checked in preflight, so a missing one stops the install instead of producing a half-working copy.");
  lines.push("");

  return lines.join("\n");
}

/** Short version for a clipboard: the argument for each shelf, in a paragraph. */
export function shelfSummaryMarkdown(): string {
  return [
    "# Why these processes exist",
    "",
    ...shelfOrder.flatMap((id) => {
      const category = CATEGORIES.find((entry) => entry.id === id)!;
      return [
        `## ${category.label}`,
        "",
        category.why,
        "",
        ...inCategory(category.id).map((capability) => `- **${capability.name}** — ${capability.why}`),
        "",
      ];
    }),
  ].join("\n");
}
