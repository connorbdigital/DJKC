import { useCallback, useMemo, useState } from "react";
import { CAPABILITIES, CATEGORIES, capabilityById, categoryCounts, categoryInfo } from "../features";
import type { Category } from "../types";
import { installFeature, preflight, type InstallResult, type Preflight } from "../installer";
import type { Repo } from "../types";
import { Checks } from "./Checks";

export function Features({ token, repos }: { token: string; repos: Repo[] }) {
  const [openId, setOpenId] = useState(CAPABILITIES[0]?.id ?? "");
  const [target, setTarget] = useState(repos[0]?.fullName ?? "");
  const [prefix, setPrefix] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Preflight | null>(null);
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState<Category | "all">("all");

  const capability = capabilityById(openId);
  const counts = useMemo(categoryCounts, []);
  const term = query.trim().toLowerCase();
  const matches = useCallback(
    (entry: (typeof CAPABILITIES)[number]) =>
      (shelf === "all" || entry.category === shelf) &&
      (!term || `${entry.name} ${entry.summary} ${entry.id}`.toLowerCase().includes(term)),
    [shelf, term]
  );
  const shown = CAPABILITIES.filter(matches);
  /* Grouped only when browsing the whole shelf; a search or a filter is already a list. */
  const grouped = shelf === "all" && !term;

  const runCheck = async () => {
    if (!capability || !target) return;
    setBusy(true);
    setError("");
    setResult(null);
    setCheck(null);
    try {
      setCheck(await preflight({ token, capability, target, prefix }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!capability || !target) return;
    if (!confirm(`Copy ${capability.name} into ${target} and open a pull request?`)) return;
    setBusy(true);
    setError("");
    setResult(null);
    setLog([]);
    try {
      const outcome = await installFeature({
        token,
        capability,
        target,
        prefix,
        preflight: check ?? undefined,
        onStep: (message) => setLog((lines) => [...lines, message]),
      });
      setResult(outcome);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The install failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split">
      <div className="col">
        <input
          className="input"
          aria-label="Search features"
          placeholder="Search the library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="chips" role="group" aria-label="Filter by category">
          <button
            className={`chip${shelf === "all" ? " is-on" : ""}`}
            aria-pressed={shelf === "all"}
            onClick={() => setShelf("all")}
          >
            All <span className="muted small">{CAPABILITIES.length}</span>
          </button>
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              className={`chip${shelf === entry.id ? " is-on" : ""}`}
              aria-pressed={shelf === entry.id}
              title={entry.blurb}
              onClick={() => setShelf(entry.id)}
            >
              {entry.label} <span className="muted small">{counts[entry.id]}</span>
            </button>
          ))}
        </div>

        {grouped ? (
          CATEGORIES.map((group) => {
            const entries = CAPABILITIES.filter((entry) => entry.category === group.id);
            if (!entries.length) return null;
            return (
              <section key={group.id} className="shelf">
                <h3 className="shelf-title">{group.label}</h3>
                <p className="muted small shelf-blurb">{group.blurb}</p>
                <ul className="list">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        className={`list-item${entry.id === openId ? " is-on" : ""}`}
                        onClick={() => setOpenId(entry.id)}
                      >
                        <span className="list-title">{entry.name}</span>
                        <span className="muted small">
                          {entry.files.length} file{entry.files.length === 1 ? "" : "s"} · v{entry.version}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <ul className="list">
            {shown.map((entry) => (
              <li key={entry.id}>
                <button className={`list-item${entry.id === openId ? " is-on" : ""}`} onClick={() => setOpenId(entry.id)}>
                  <span className="list-title">{entry.name}</span>
                  <span className="muted small">
                    {categoryInfo(entry.category)?.label} · {entry.files.length} file{entry.files.length === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="muted">Nothing matches that yet.</li>}
          </ul>
        )}
      </div>

      <div className="col">
        {capability && (
          <div className="panel">
            <h2>{capability.name}</h2>
            <p>{capability.summary}</p>

            <h3>Files copied</h3>
            <ul className="files">
              {capability.files.map((file) => (
                <li key={file.path}>
                  <code>{file.path}</code>
                  <span className="muted small"> — {file.role}</span>
                  {file.adapt && <span className="badge warn">needs editing</span>}
                </li>
              ))}
            </ul>

            {!!capability.expects.length && (
              <>
                <h3>Reads from your project</h3>
                <ul className="files">
                  {capability.expects.map((file) => (
                    <li key={file.path}>
                      <code>{file.path}</code>
                      <span className="muted small"> — {file.role}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!!capability.env.length && (
              <>
                <h3>Environment variables</h3>
                <p className="mono small">{capability.env.join(" · ")}</p>
              </>
            )}

            {!!capability.requires.length && (
              <>
                <h3>Depends on</h3>
                <p className="mono small">{capability.requires.join(" · ")}</p>
              </>
            )}

            {!!capability.manual.length && (
              <>
                <h3>Still to do by hand</h3>
                <ul>
                  {capability.manual.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </>
            )}

            <div className="installer">
              <h3>Add to a project</h3>
              <div className="fields">
                <label>
                  Target repository
                  <select value={target} onChange={(event) => setTarget(event.target.value)}>
                    {repos.map((repo) => (
                      <option key={repo.id} value={repo.fullName}>{repo.fullName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Folder (optional)
                  <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="e.g. src/features" />
                </label>
              </div>
              <div className="actions">
                <button className="btn" onClick={runCheck} disabled={busy || !target}>
                  {busy ? "Checking…" : "Check against target"}
                </button>
                <button className="btn primary" onClick={install} disabled={busy || !target}>
                  {busy ? "Working…" : "Copy files and open a pull request"}
                </button>
              </div>

              {check && (
                <div className="check-result">
                  <p className="muted small">
                    {check.files.length} file{check.files.length === 1 ? "" : "s"} read · {check.files.reduce((total, file) => total + file.bytes, 0).toLocaleString("en-GB")} bytes
                  </p>
                  {check.collisions.length > 0 && (
                    <p className="warn-line">Will overwrite: {check.collisions.join(", ")}</p>
                  )}
                  {check.missingDependencies.length > 0 && (
                    <p className="warn-line">Install first: {check.missingDependencies.join(", ")}</p>
                  )}
                  {check.missingExpectations.length > 0 && (
                    <p className="warn-line">Not in this project yet: {check.missingExpectations.join("; ")}</p>
                  )}
                  {check.unresolved.length > 0 ? (
                    <ul className="unresolved">
                      {check.unresolved.map((entry) => (
                        <li key={`${entry.file}-${entry.specifier}`}>
                          <code>{entry.file}</code> imports <code>{entry.specifier}</code> — not in the target yet
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ok small">Every relative import resolves inside the files being copied.</p>
                  )}
                </div>
              )}
              <p className="muted small">
                Files are copied byte-for-byte from <code>{capability.source}</code>. The pull request lists what still needs
                editing — usually imports and copy. Nothing is merged.
              </p>

              {!!log.length && (
                <ol className="log">
                  {log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
                </ol>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              {result && (
                <>
                  <p className="ok">
                    Opened <a href={result.pullUrl} target="_blank" rel="noreferrer">#{result.pullNumber}</a> on {target} —
                    {" "}{result.paths.length} file{result.paths.length === 1 ? "" : "s"} written
                    {result.skipped.length ? `, ${result.skipped.length} skipped as missing in the source` : ""}.
                  </p>
                  <Checks token={token} repo={target} branch={result.branch} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
