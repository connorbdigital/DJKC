import type { DraftPlan } from "./types";

export interface DraftInput {
  brief: string;
  repo: string;
  features: string[];
  context?: { path: string; excerpt: string }[];
}

export async function requestDraft(input: DraftInput): Promise<DraftPlan & { model?: string }> {
  const response = await fetch("/api/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error ?? `The drafting service answered ${response.status}.`);
  }
  return data as DraftPlan & { model?: string };
}
