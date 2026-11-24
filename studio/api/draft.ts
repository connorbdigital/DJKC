import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Drafts a change proposal. It does NOT touch GitHub — the browser shows the
 * plan, a human edits or approves it, and only then does anything get written.
 * Model access lives here so the key never reaches the browser.
 */

interface DraftRequest {
  brief?: unknown;
  repo?: unknown;
  features?: unknown;
  context?: unknown;
}

const SAFE_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]{3,180}$/;
const MAX_FILES = 8;
const MAX_FILE_CHARS = 24_000;

const SYSTEM = `You are the drafting half of a small studio that maintains real web projects.
You receive a brief and a list of features that already exist in other projects.
You reply with ONE JSON object and nothing else — no prose, no code fences:
{"summary": string, "steps": string[], "files": [{"path": string, "content": string, "note": string}]}

Rules:
- Propose complete, ready-to-save file contents, not diffs and not fragments.
- Prefer reusing the features listed as available over inventing new subsystems.
- Match the project's existing stack and conventions given in the context.
- Never invent API keys, secrets, tokens or personal data. Use environment variable names instead.
- Paths are relative, with no leading slash and no "..".
- Keep the change small enough for one review: at most ${MAX_FILES} files.
- If the brief is impossible or too vague, return an empty files array and explain why in steps.`;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function parsePlan(text: string): { summary: string; steps: string[]; files: { path: string; content: string; note: string }[] } | null {
  const stripped = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const raw = JSON.parse(stripped.slice(start, end + 1)) as {
      summary?: unknown;
      steps?: unknown;
      files?: unknown;
    };
    const files = Array.isArray(raw.files)
      ? raw.files
          .map((file) => {
            const entry = file as { path?: unknown; content?: unknown; note?: unknown };
            return {
              path: clean(entry.path, 200),
              content: typeof entry.content === "string" ? entry.content.slice(0, MAX_FILE_CHARS) : "",
              note: clean(entry.note, 400),
            };
          })
          .filter((file) => SAFE_PATH.test(file.path) && file.content.length > 0)
          .slice(0, MAX_FILES)
      : [];
    const steps = Array.isArray(raw.steps) ? raw.steps.map((s) => clean(s, 300)).filter(Boolean).slice(0, 12) : [];
    return { summary: clean(raw.summary, 1200), steps, files };
  } catch {
    return null;
  }
}

export default async function draft(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(405, { error: "POST required" });
  }

  let body = (req.body ?? null) as DraftRequest | null;
  if (!body && typeof req.on === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    if (text) {
      try {
        body = JSON.parse(text) as DraftRequest;
      } catch {
        return send(400, { error: "Expected JSON" });
      }
    }
  }

  const brief = clean(body?.brief, 4000);
  const repo = clean(body?.repo, 120);
  const features = Array.isArray(body?.features) ? body.features.map((f) => clean(f, 80)).filter(Boolean).slice(0, 20) : [];
  const context = Array.isArray(body?.context)
    ? body.context
        .map((entry) => {
          const item = entry as { path?: unknown; excerpt?: unknown };
          return `${clean(item.path, 160)}\n${clean(item.excerpt, 4000)}`;
        })
        .slice(0, 6)
    : [];

  if (brief.length < 12) return send(400, { error: "Give the agent a brief of at least a sentence." });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return send(503, { error: "Set ANTHROPIC_API_KEY in Vercel to let the agent draft." });
  const model = process.env.STUDIO_MODEL || "claude-sonnet-4-5";

  const prompt = [
    `Project: ${repo || "(unspecified)"}`,
    features.length ? `Features already available to reuse: ${features.join(", ")}` : "No shared features selected.",
    context.length ? `Current files:\n\n${context.join("\n\n---\n\n")}` : "No files supplied.",
    "",
    `Brief:\n${brief}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return send(502, { error: `The model rejected the request (${response.status}).`, detail: detail.slice(0, 400) });
    }

    const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (payload.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim();
    const plan = parsePlan(text);
    if (!plan) return send(502, { error: "The model did not return a usable plan.", detail: text.slice(0, 600) });

    return send(200, { ok: true, model, ...plan });
  } catch {
    return send(502, { error: "The model call timed out or failed." });
  }
}
