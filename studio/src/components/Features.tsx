import { useMemo, useState } from "react";
import { CAPABILITIES, capabilityById } from "../features";
import { installFeature, preflight, type InstallResult, type Preflight } from "../installer";
import type { Repo } from "../types";

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

  const capability = capabilityById(openId);
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? CAPABILITIES.filter((entry) => `${entry.name} ${entry.summary}`.toLowerCase().includes(term))
      : CAPABILITIES;
  }, [query]);

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
        <ul className="list">
          {shown.map((entry) => (
            <li key={entry.id}>
              <button className={`list-item${entry.id === openId ? " is-on" : ""}`} onClick={() => setOpenId(entry.id)}>
                <span className="list-title">{entry.name}</span>
                <span className="muted small">{entry.files.length} file{entry.files.length === 1 ? "" : "s"} · {entry.source}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="muted">Nothing matches that yet.</li>}
        </ul>
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
                <p className="ok">
                  Opened <a href={result.pullUrl} target="_blank" rel="noreferrer">#{result.pullNumber}</a> on {target} —
                  {" "}{result.paths.length} file{result.paths.length === 1 ? "" : "s"} written
                  {result.skipped.length ? `, ${result.skipped.length} skipped as missing in the source` : ""}.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
