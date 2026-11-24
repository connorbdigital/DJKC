import { useEffect, useState } from "react";
import { checksFor } from "../github";
import type { CheckRun } from "../types";

/**
 * Asks the target repo how the pull request is doing. Refreshes while anything
 * is still running, and says so plainly when a repo has no CI at all.
 */
export function Checks({ token, repo, branch }: { token: string; repo: string; branch: string }) {
  const [runs, setRuns] = useState<CheckRun[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    setRuns(null);
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const list = await checksFor(token, repo, branch);
        if (cancelled) return;
        setRuns(list);
        const pending = list.some((run) => run.status !== "completed");
        if (pending && attempts < 8) window.setTimeout(poll, 15_000);
      } catch {
        if (!cancelled) setRuns([]);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [token, repo, branch]);

  return (
    <div className="checks">
      <h3 style={{ marginTop: 0 }}>Checks on {branch}</h3>
      {runs === null && <p className="muted small">Asking the target repo…</p>}
      {runs?.length === 0 && (
        <p className="muted small">
          No checks reported. That usually means the project has no CI yet — the pull request still needs a human read.
        </p>
      )}
      {!!runs?.length && (
        <ul>
          {runs.map((run) => (
            <li key={run.name}>
              <a href={run.url} target="_blank" rel="noreferrer">
                {run.name}
              </a>{" "}
              <span className={`badge ${run.conclusion === "success" ? "good" : run.status !== "completed" ? "" : "warn"}`}>
                {run.conclusion ?? run.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {runs?.some((run) => run.status !== "completed") && <p className="muted small">Still running — this refreshes itself.</p>}
    </div>
  );
}
