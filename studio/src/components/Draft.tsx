import { useState } from "react";
import { requestDraft } from "../agent";
import { CAPABILITIES } from "../features";
import { createBranch, defaultBranch, openPull, writeFile } from "../github";
import { branchName, targetPath } from "../installer";
import type { DraftPlan, Repo } from "../types";

export function Draft({ token, repos }: { token: string; repos: Repo[] }) {
  const [brief, setBrief] = useState("");
  const [target, setTarget] = useState(repos[0]?.fullName ?? "");
  const [prefix, setPrefix] = useState("");
  const [reuse, setReuse] = useState<string[]>(["booking-form-deposits"]);
  const [plan, setPlan] = useState<(DraftPlan & { model?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const toggle = (id: string) =>
    setReuse((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const draft = async () => {
    setBusy(true);
    setError("");
    setPrUrl("");
    setPlan(null);
    try {
      const result = await requestDraft({ brief, repo: target, features: reuse });
      setPlan(result);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The agent did not answer.");
    } finally {
      setBusy(false);
    }
  };

  const openPr = async () => {
    if (!plan || !target) return;
    if (!confirm(`Write ${plan.files.length} file(s) to ${target} and open a pull request for review?`)) return;
    setBusy(true);
    setError("");
    setLog([]);
    try {
      const base = await defaultBranch(token, target);
      const branch = branchName("agent", new Date());
      setLog((lines) => [...lines, `Branch ${branch} from ${base}`]);
      await createBranch(token, target, branch, base);
      for (const file of plan.files) {
        const destination = targetPath(prefix, file.path);
        setLog((lines) => [...lines, `Writing ${destination}`]);
        await writeFile(token, target, destination, file.content, branch, `Studio agent: ${file.path}`);
      }
      const pull = await openPull(token, target, {
        title: `Studio: ${plan.summary.slice(0, 60) || "drafted change"}`,
        head: branch,
        base,
        body: [
          plan.summary,
          "",
          "## Plan",
          ...plan.steps.map((step) => `- ${step}`),
          "",
          "## Files",
          ...plan.files.map((file) => `- \`${targetPath(prefix, file.path)}\`${file.note ? ` — ${file.note}` : ""}`),
          "",
          "---",
          `Drafted by Studio${plan.model ? ` (${plan.model})` : ""} from a written brief. Nothing was executed, installed or deployed.`,
          "Review every file before merging: this is a proposal, not a tested change.",
        ].join("\n"),
      });
      setPrUrl(pull.url);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not open the pull request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Ask the agent for a change</h2>
      <p className="muted">
        It reads the brief and the features you tick, then proposes whole files. It never touches the repository until you
        press the second button — and it never merges.
      </p>

      <label htmlFor="brief">Brief</label>
      <textarea
        id="brief"
        rows={5}
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        placeholder="Add a pricing page to the Kaysie site with three packages in GBP, a deposit CTA and FAQ schema."
      />

      <div className="fields">
        <label>
          Project
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {repos.map((repo) => <option key={repo.id} value={repo.fullName}>{repo.fullName}</option>)}
          </select>
        </label>
        <label>
          Folder (optional)
          <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="e.g. src/pages" />
        </label>
      </div>

      <fieldset className="reuse">
        <legend>Reuse these features as context</legend>
        {CAPABILITIES.map((capability) => (
          <label key={capability.id} className="check">
            <input
              type="checkbox"
              checked={reuse.includes(capability.id)}
              onChange={() => toggle(capability.id)}
            />
            {capability.name}
          </label>
        ))}
      </fieldset>

      <button className="btn primary" onClick={draft} disabled={busy || brief.trim().length < 12}>
        {busy && !plan ? "Thinking…" : "Draft with the agent"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}

      {plan && (
        <div className="plan">
          <h3>Proposal{plan.model ? <span className="muted small"> · {plan.model}</span> : null}</h3>
          <p>{plan.summary || "No summary given."}</p>
          {!!plan.steps.length && (
            <ol>
              {plan.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          )}
          {plan.files.length ? (
            <>
              <h3>Files ({plan.files.length})</h3>
              {plan.files.map((file) => (
                <details key={file.path} className="file">
                  <summary>
                    <code>{targetPath(prefix, file.path)}</code>
                    {file.note ? <span className="muted small"> — {file.note}</span> : null}
                  </summary>
                  <pre>{file.content}</pre>
                </details>
              ))}
              <button className="btn primary" onClick={openPr} disabled={busy}>
                {busy ? "Opening…" : "Open a pull request for review"}
              </button>
            </>
          ) : (
            <p className="muted">The agent did not propose any files — read its steps above for why.</p>
          )}
          {!!log.length && (
            <ol className="log">
              {log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
            </ol>
          )}
          {prUrl && (
            <p className="ok">
              Opened <a href={prUrl} target="_blank" rel="noreferrer">the pull request</a>. Review it, then let CI decide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
