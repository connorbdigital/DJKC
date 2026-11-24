import { useEffect, useState } from "react";
import { PACKS, packById, packEnv, packExpects, packManual, planFiles, resolvePack, sharedFiles } from "../packs";
import { installPack, parseManifest, preflightPack, type PackInstallResult, type Preflight } from "../installer";
import { readFile } from "../github";
import type { Repo } from "../types";
import { Checks } from "./Checks";

export function Packs({ token, repos }: { token: string; repos: Repo[] }) {
  const [openId, setOpenId] = useState(PACKS[0]?.id ?? "");
  const [target, setTarget] = useState(repos[0]?.fullName ?? "");
  const [prefix, setPrefix] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<PackInstallResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Preflight | null>(null);
  const [present, setPresent] = useState<string[] | null>(null);

  const pack = packById(openId);

  /* Read the target's manifest so the panel can say what is already there. */
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setPresent(null);
    readFile(token, target, "studio/features.json")
      .then((text) => {
        if (!cancelled) setPresent(parseManifest(text).features.map((entry) => entry.id));
      })
      .catch(() => {
        if (!cancelled) setPresent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, target, result]);

  if (!pack) return null;

  let capabilities;
  try {
    capabilities = resolvePack(pack);
  } catch (problem) {
    return <p className="error" role="alert">{problem instanceof Error ? problem.message : "That pack is broken."}</p>;
  }
  const files = planFiles(capabilities, prefix);
  const shared = sharedFiles(files);
  const env = packEnv(capabilities);
  const expects = packExpects(capabilities, prefix);
  const manual = packManual(capabilities);
  const already = (id: string) => Boolean(present?.includes(id));
  const allHere = present !== null && pack.features.every((id) => present.includes(id));

  const runCheck = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    setCheck(null);
    setResult(null);
    try {
      setCheck(await preflightPack({ token, pack, target, prefix }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!target) return;
    if (!confirm(`Write ${files.length} files for "${pack.name}" to ${target} and open one pull request?`)) return;
    setBusy(true);
    setError("");
    setResult(null);
    setLog([]);
    try {
      const outcome = await installPack({
        token,
        pack,
        target,
        prefix,
        preflight: check ?? undefined,
        onStep: (message) => setLog((lines) => [...lines, message]),
      });
      setResult(outcome);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The pack could not be installed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split">
      <div className="col">
        <ul className="list">
          {PACKS.map((entry) => (
            <li key={entry.id}>
              <button
                className={`list-item${entry.id === openId ? " is-on" : ""}`}
                onClick={() => {
                  setOpenId(entry.id);
                  setCheck(null);
                  setResult(null);
                  setLog([]);
                  setError("");
                }}
              >
                <span className="list-title">{entry.name}</span>
                <span className="muted small">
                  {entry.features.length} features · {planFiles(resolvePack(entry), "").length} files
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">
          A pack is one pull request containing features that already ship. Dependencies are ordered for you; nothing is
          merged, deployed or run.
        </p>
      </div>

      <div className="col">
        <div className="panel">
          <h2>{pack.name}</h2>
          <p>{pack.summary}</p>

          <h3>What lands, in order</h3>
          <ol className="files">
            {capabilities.map((capability) => (
              <li key={capability.id}>
                <code>{capability.id}</code> <span className="muted small">v{capability.version}</span>
                <span className="muted small"> — {capability.name}, {capability.files.length} file{capability.files.length === 1 ? "" : "s"}</span>
                {already(capability.id) ? (
                  <span className="badge good">already here</span>
                ) : (
                  <span className="badge warn">new here</span>
                )}
              </li>
            ))}
          </ol>

          {present === null && <p className="muted small">Reading this project's manifest…</p>}
          {allHere && (
            <p className="muted small">
              Everything in this pack is already recorded in {target}. Installing again re-copies the files and replaces those
              entries in the manifest — useful for picking up a newer version, and it will overwrite local edits.
            </p>
          )}

          {!!shared.length && (
            <>
              <h3>Files several features share</h3>
              <ul className="files">
                {shared.map((file) => (
                  <li key={file.destination}>
                    <code>{file.destination}</code> <span className="muted small">— written once, used by {file.from.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Before you start</h3>
          <ul>
            {pack.before.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {!!expects.length && (
            <>
              <h3>Reads from your project</h3>
              <ul className="files">
                {expects.map((entry) => (
                  <li key={entry.path}>
                    <code>{entry.path}</code> <span className="muted small">— {entry.role}</span>
                    {entry.internal && <span className="badge">in this pack</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {!!env.length && (
            <>
              <h3>Environment variables</h3>
              <p className="mono small">{env.join(" · ")}</p>
            </>
          )}

          {!!manual.length && (
            <>
              <h3>Still to do by hand</h3>
              <ul>
                {manual.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}

          <div className="installer">
            <h3>Set it up</h3>
            <div className="fields">
              <label>
                Target repository
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName}
                    </option>
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
                {busy ? "Working…" : `Write ${files.length} files and open one pull request`}
              </button>
            </div>

            {check && (
              <div className="check-result">
                <p className="muted small">
                  {check.files.length} file{check.files.length === 1 ? "" : "s"} read ·{" "}
                  {check.files.reduce((total, file) => total + file.bytes, 0).toLocaleString("en-GB")} bytes
                </p>
                {check.collisions.length > 0 && <p className="warn-line">Will overwrite: {check.collisions.join(", ")}</p>}
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
                  <p className="ok small">
                    Every relative import resolves inside the files being copied or already in the project.
                  </p>
                )}
              </div>
            )}

            <p className="muted small">
              Files come byte-for-byte from the source project, pinned to its current commit. The pull request lists what still
              needs editing. Nothing is merged.
            </p>

            {!!log.length && (
              <ol className="log">
                {log.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ol>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {result && (
              <>
                <p className="ok">
                  Opened <a href={result.pullUrl} target="_blank" rel="noreferrer">#{result.pullNumber}</a> on {target} —{" "}
                  {result.paths.length} file{result.paths.length === 1 ? "" : "s"} across {result.features.length} feature
                  {result.features.length === 1 ? "" : "s"}
                  {result.skipped.length ? `, ${result.skipped.length} skipped as missing in the source` : ""}.
                </p>
                <Checks token={token} repo={target} branch={result.branch} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
