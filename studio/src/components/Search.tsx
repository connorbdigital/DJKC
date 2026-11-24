import { useMemo, useState } from "react";
import { searchCode } from "../github";
import { groupByRepo, type CodeSearchResult } from "../codeSearch";
import type { Repo } from "../types";
import { SiteCheckPanel } from "./SiteCheckPanel";

/**
 * Two different kinds of looking: inside the projects (GitHub code search,
 * which the token already allows) and outside them (one public page, fetched
 * by the Studio's own serverless function).
 */
export function Search({ token, repos, login }: { token: string; repos: Repo[]; login: string }) {
  const [mode, setMode] = useState<"code" | "site">("code");
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState("");
  const [result, setResult] = useState<CodeSearchResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => (result ? groupByRepo(result.matches) : []), [result]);

  const run = async () => {
    if (!term.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await searchCode(token, term, scope ? { repo: scope } : { login }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Search did not answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col wide">
      <div className="chips" role="group" aria-label="What to search">
        <button className={`chip${mode === "code" ? " is-on" : ""}`} aria-pressed={mode === "code"} onClick={() => setMode("code")}>
          Inside the projects
        </button>
        <button className={`chip${mode === "site" ? " is-on" : ""}`} aria-pressed={mode === "site"} onClick={() => setMode("site")}>
          One public page
        </button>
      </div>

      {mode === "code" ? (
        <div className="panel">
          <h2>Search the code</h2>
          <p className="muted small">
            GitHub searches the default branch of every repository you can see. Ten requests a minute, so this is a
            deliberate question rather than live filtering.
          </p>
          <div className="fields">
            <label>
              Words to find
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void run();
                }}
                placeholder="e.g. STRIPE_SECRET_KEY"
                aria-label="Code search"
              />
            </label>
            <label>
              Project
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="">Everything ({login})</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={run} disabled={busy || !term.trim()}>
              {busy ? "Searching…" : "Search"}
            </button>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className="results">
              <p className="muted small">
                {result.total.toLocaleString("en-GB")} match{result.total === 1 ? "" : "es"} for “{result.term}”
                {result.truncated ? ` — showing the first ${result.matches.length}` : ""}
              </p>
              {!result.matches.length && <p className="muted">Nothing in the default branches. Try a shorter phrase.</p>}
              {groups.map((group) => (
                <section key={group.repo} className="shelf">
                  <h3 className="shelf-title">
                    {group.repo} <span className="muted small">{group.matches.length}</span>
                  </h3>
                  <ul className="files">
                    {group.matches.map((match) => (
                      <li key={`${match.repo}-${match.path}`}>
                        <a href={match.url} target="_blank" rel="noreferrer">
                          <code>{match.path}</code>
                        </a>
                        {match.fragments.map((fragment, index) => (
                          <pre className="snippet" key={index}>
                            {fragment}
                          </pre>
                        ))}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <SiteCheckPanel />
      )}
    </div>
  );
}
