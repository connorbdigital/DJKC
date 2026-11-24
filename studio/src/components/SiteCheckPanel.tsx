import { useState } from "react";
import { checkUrl, type SiteReport } from "../sitecheck";

/**
 * Reads one public page through /api/site and reports what it says about
 * itself. Nothing is crawled, nothing is stored, and the HTML never comes back
 * to this tab — only the summary.
 */
export function SiteCheckPanel() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<(SiteReport & { truncated?: boolean }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError("");
    setReport(null);
    const verdict = checkUrl(url);
    if (!verdict.ok) {
      setError(verdict.reason ?? "That URL cannot be checked.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: verdict.url!.toString() }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; report: SiteReport & { truncated?: boolean } }
        | { ok: false; error: string }
        | null;
      if (!data) throw new Error(`The site check answered ${response.status}.`);
      if (!data.ok) throw new Error(data.error);
      setReport(data.report);
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "The page could not be checked.";
      setError(
        /405|404|Failed to fetch|not found/i.test(message)
          ? "The site check runs on the deployed Studio, not in local development. Deploy it, or paste the HTML elsewhere."
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  const passes = report?.checks.filter((check) => check.status === "pass").length ?? 0;

  return (
    <div className="panel">
      <h2>Check one public page</h2>
      <p className="muted small">
        For looking at a competitor, or your own shop after a deploy. The server fetches one https page, reads its head and
        markup, and returns a summary — no crawling, no screenshots, nothing stored.
      </p>
      <div className="fields">
        <label>
          Page address
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
            placeholder="https://example.com/products/thing"
            aria-label="Page address"
          />
        </label>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={run} disabled={busy || !url.trim()}>
          {busy ? "Reading…" : "Check the page"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {report && (
        <div className="site-report">
          <p className="ok">
            {report.verdict} {passes}/{report.checks.length} checks pass.
            {report.truncated ? " The page was cut at 1.5 MB, so counts are a floor." : ""}
          </p>
          <p className="muted small">
            <a href={report.url} target="_blank" rel="noreferrer">
              {report.url}
            </a>
            {report.title ? ` — “${report.title}”` : ""}
          </p>
          <ul className="checks-list">
            {report.checks.map((check) => (
              <li key={check.id}>
                <span className={`dot ${check.status}`} aria-hidden="true" />
                <span className="check-label">{check.label}</span>
                <span className={`badge ${check.status === "pass" ? "good" : check.status === "warn" ? "warn" : "bad"}`}>
                  {check.status}
                </span>
                <span className="muted small">{check.detail}</span>
                {check.status !== "pass" && <span className="because small">{check.because}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
