import { useState } from "react";
import { CAPABILITIES, capabilityById } from "../features";
import { installFeature, type InstallResult } from "../installer";
import type { Repo } from "../types";

export function Features({ token, repos }: { token: string; repos: Repo[] }) {
  const [openId, setOpenId] = useState(CAPABILITIES[0]?.id ?? "");
  const [target, setTarget] = useState(repos[0]?.fullName ?? "");
  const [prefix, setPrefix] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const capability = capabilityById(openId);

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
        <ul className="list">
          {CAPABILITIES.map((entry) => (
            <li key={entry.id}>
              <button className={`list-item${entry.id === openId ? " is-on" : ""}`} onClick={() => setOpenId(entry.id)}>
                <span className="list-title">{entry.name}</span>
                <span className="muted small">{entry.files.length} file{entry.files.length === 1 ? "" : "s"} · {entry.source}</span>
              </button>
            </li>
          ))}
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
              <button className="btn primary" onClick={install} disabled={busy || !target}>
                {busy ? "Working…" : "Copy files and open a pull request"}
              </button>
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
