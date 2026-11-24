/**
 * Every project can carry a `studio.json` at its root: its stack, the rules it
 * must not break, and the decisions that took a conversation to reach. The
 * agent reads it before drafting, so proposals stop being generic.
 */
export interface ProjectRules {
  version: 1;
  name: string;
  summary: string;
  stack: string[];
  /** Hard constraints, in the owner's words. */
  rules: string[];
  design: Record<string, string>;
}

export function defaultRules(repo: string): ProjectRules {
  const name = repo.split("/").pop() ?? "project";
  return {
    version: 1,
    name,
    summary: "",
    stack: ["Vite", "React", "TypeScript", "Vercel"],
    rules: [
      "Never commit secrets or keys; use environment variables.",
      "Keep text legible: real contrast, no text over busy imagery.",
      "Do not claim something is booked, stored or paid unless it is.",
      "Prefer reusing a feature from the studio library over inventing a new one.",
    ],
    design: { palette: "", type: "", voice: "" },
  };
}

export const serialiseRules = (rules: ProjectRules): string => `${JSON.stringify(rules, null, 2)}\n`;

/** A short, prompt-ready brief. Tolerant of a half-filled or broken file. */
export function rulesBrief(text: string | null): string {
  if (!text) return "";
  try {
    const raw = JSON.parse(text) as Partial<ProjectRules>;
    const lines = [
      raw.name ? `Project: ${raw.name}` : "",
      raw.summary ? `About: ${raw.summary}` : "",
      raw.stack?.length ? `Stack: ${raw.stack.join(", ")}` : "",
      raw.rules?.length ? `Rules to respect:\n${raw.rules.map((rule) => `- ${rule}`).join("\n")}` : "",
      raw.design && Object.keys(raw.design).length
        ? `Design notes: ${Object.entries(raw.design)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key} — ${value}`)
            .join("; ")}`
        : "",
    ];
    return lines.filter(Boolean).join("\n").slice(0, 4000);
  } catch {
    return "";
  }
}
