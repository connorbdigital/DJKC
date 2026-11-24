import { CAPABILITIES } from "./features";

/**
 * Reading a project as it is, not as it was described.
 *
 * The Studio already knows what a project should contain (the feature
 * library). This turns the actual file tree into an answer to "what is in
 * here": the stack, the routes, the pages, the tests, and which of the known
 * features are present — with the files that prove it.
 *
 * Nothing here guesses silently: every detected feature names its evidence,
 * and anything missing is a note rather than an absence.
 */

export interface InventoryInput {
  /** Every blob path in the repository, from the git tree. */
  paths: string[];
  /** Raw package.json, when the project has one. */
  packageJson?: string | null;
  /** Raw studio/features.json, when the project has been through the Studio. */
  manifest?: string | null;
  /** True when GitHub truncated the tree. */
  truncated?: boolean;
}

export interface DetectedFeature {
  id: string;
  name: string;
  /** Files that prove it is here. */
  evidence: string[];
  /** Present but not recorded in studio/features.json. */
  unrecorded: boolean;
  /** Version recorded by the Studio, when it has one. */
  version?: string;
}

export interface Inventory {
  files: number;
  stack: string[];
  apiRoutes: string[];
  pages: string[];
  componentCount: number;
  testCount: number;
  docs: string[];
  env: string[];
  features: DetectedFeature[];
  recorded: string[];
  notes: string[];
}

const STACK_MARKERS: { match: string[]; label: string }[] = [
  { match: ["next"], label: "Next.js" },
  { match: ["react"], label: "React" },
  { match: ["vue"], label: "Vue" },
  { match: ["svelte", "@sveltejs/kit"], label: "Svelte" },
  { match: ["vite"], label: "Vite" },
  { match: ["typescript"], label: "TypeScript" },
  { match: ["tailwindcss"], label: "Tailwind" },
  { match: ["vitest"], label: "Vitest" },
  { match: ["jest"], label: "Jest" },
  { match: ["playwright", "@playwright/test"], label: "Playwright" },
  { match: ["express", "fastify", "hono"], label: "Node server" },
  { match: ["stripe", "@stripe/stripe-js"], label: "Stripe" },
  { match: ["resend"], label: "Resend" },
  { match: ["@vercel/kv", "ioredis"], label: "KV store" },
  { match: ["@anthropic-ai/sdk", "openai"], label: "Model API" },
];

const readPackage = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})];
  } catch {
    return [];
  }
};

export function detectStack(paths: string[], dependencies: string[]): string[] {
  const stack: string[] = [];
  const has = (dependency: string) => dependencies.some((name) => name === dependency || name.startsWith(`${dependency}/`));
  for (const marker of STACK_MARKERS) {
    if (marker.match.some(has)) stack.push(marker.label);
  }
  if (!paths.length) return stack;
  if (paths.some((path) => path.startsWith("api/") && /\.(ts|tsx|js|mts)$/.test(path)) && !stack.includes("Node server")) {
    stack.push("Vercel functions");
  }
  if (paths.some((path) => path.endsWith(".astro")) && !stack.includes("Astro")) stack.push("Astro");
  if (!stack.length) stack.push(dependencies.length ? "Node" : "Static files");
  return stack;
}

const isTest = (path: string) => /(^|\/)(tests?|__tests__)\//.test(path) || /\.(test|spec)\.[a-z]+$/.test(path);

/** The whole picture, from a file list and two optional documents. */
export function takeInventory(input: InventoryInput): Inventory {
  const paths = [...new Set(input.paths)].sort();
  const dependencies = readPackage(input.packageJson);
  const apiRoutes = paths.filter((path) => /^api\//.test(path) && /\.(ts|tsx|js|mjs|mts)$/.test(path) && !isTest(path));
  const pages = paths.filter(
    (path) =>
      /^[^/]+\.html$/.test(path) ||
      /^public\/[^/]+\.html$/.test(path) ||
      /^src\/pages\//.test(path) ||
      /^app\/(.+\/)?page\.(tsx|ts|jsx|js|mdx)$/.test(path)
  );
  const componentCount = paths.filter((path) => /^src\/components\//.test(path) && /\.(tsx|jsx|ts|js)$/.test(path)).length;
  const testCount = paths.filter(isTest).length;
  const docs = paths.filter((path) => /^[^/]+\.md$/i.test(path) || /^docs\/[^/]+\.md$/i.test(path)).slice(0, 10);

  const recorded = (() => {
    if (!input.manifest) return [];
    try {
      const parsed = JSON.parse(input.manifest) as { features?: { id?: string; version?: string }[] };
      return (parsed.features ?? []).map((entry) => entry.id ?? "").filter(Boolean);
    } catch {
      return [];
    }
  })();

  const features: DetectedFeature[] = [];
  for (const capability of CAPABILITIES) {
    const evidence = capability.files.map((file) => file.path).filter((path) => paths.includes(path));
    if (!evidence.length) continue;
    features.push({
      id: capability.id,
      name: capability.name,
      evidence,
      unrecorded: !recorded.includes(capability.id),
      version: capability.version,
    });
  }

  const env = [...new Set(features.flatMap((feature) => CAPABILITIES.find((entry) => entry.id === feature.id)?.env ?? []))].sort();

  const notes: string[] = [];
  if (input.truncated) notes.push("The file list was cut short by GitHub, so counts are a floor.");
  if (!paths.some((path) => path.startsWith(".github/workflows/"))) notes.push("No CI workflow: nothing will check a pull request automatically.");
  if (!testCount) notes.push("No tests found.");
  if (!docs.length) notes.push("No README or docs.");
  if (!recorded.length) {
    notes.push("Nothing recorded in studio/features.json — features below were detected from files alone.");
  }
  const unrecorded = features.filter((feature) => feature.unrecorded).length;
  if (unrecorded) notes.push(`${unrecorded} detected feature${unrecorded === 1 ? "" : "s"} not recorded by the Studio.`);

  return {
    files: paths.length,
    stack: detectStack(paths, dependencies),
    apiRoutes,
    pages,
    componentCount,
    testCount,
    docs,
    env,
    features: features.sort((a, b) => a.name.localeCompare(b.name)),
    recorded,
    notes,
  };
}

/** A short paragraph a person can paste into a brief. */
export function summariseInventory(name: string, inventory: Inventory): string {
  const lines = [
    `${name}: ${inventory.files} files, built with ${inventory.stack.join(", ")}.`,
    inventory.apiRoutes.length ? `Routes: ${inventory.apiRoutes.join(", ")}.` : "No serverless routes.",
    inventory.pages.length ? `Pages: ${inventory.pages.slice(0, 6).join(", ")}.` : "",
    inventory.features.length
      ? `Known features: ${inventory.features
          .slice(0, 6)
          .map((feature) => `${feature.name}${feature.unrecorded ? " (unrecorded)" : ""}`)
          .join("; ")}${inventory.features.length > 6 ? ` and ${inventory.features.length - 6} more` : ""}.`
      : "No known features detected.",
    inventory.env.length ? `Needs: ${inventory.env.join(", ")}.` : "",
  ];
  return lines.filter(Boolean).join(" ");
}
