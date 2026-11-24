import { useEffect, useState } from "react";
import { requestDraft } from "../agent";
import { CAPABILITIES } from "../features";
import { createBranch, defaultBranch, openPull, readFile, writeFile } from "../github";
import { branchName, targetPath } from "../installer";
import { defaultRules, rulesBrief, serialiseRules } from "../project";
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
  const [context, setContext] = useState<{ path: string; excerpt: string }[]>([]);
  const [rules, setRules] = useState<{ text: string | null; checked: boolean }>({ text: null, checked: false });
  const [pathToAttach, setPathToAttach] = useState("");
  const [log, setLog] = useState<string[]>([]);

  /* Project rules live in studio.json at the repo root. */
  useEffect(() => {
    let cancelled = false;
    setRules({ text: null, checked: false });
    if (!target) return;
    readFile(token, target, "studio.json")
      .then((text) => { if (!cancelled) setRules({ text, checked: true }); })
      .catch(() => { if (!cancelled) setRules({ text: null, checked: true }); });
    return () => { cancelled = true; };
  }, [token, target]);

  const createRules = async () => {
    setBusy(true);
    setError("");
    try {
      const base = await defaultBranch(token, target);
      const branch = branchName("studio-json", new Date());
      const text = serialiseRules(defaultRules(target));
      await createBranch(token, target, branch, base);
      await writeFile(token, target, "studio.json", text, branch, "Add studio.json project rules");
      const pull = await openPull(token, target, {
        title: "Studio: add studio.json",
        head: branch,
        base,
        body: [
          "Adds `studio.json`: this project's stack, its hard rules and its design notes.",
          "",
          "The Studio's agent reads this before drafting, so proposals respect the decisions this project has already made. Fill in the empty fields — the more specific the rules, the less generic the output.",
        ].join("\n"),
      });
      setRules({ text, checked: true });
      setPrUrl(pull.url);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not create studio.json.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setReuse((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const draft = async () => {
    setBusy(true);
    setError("");
    setPrUrl("");
    setPlan(null);
    try {
      const briefed = rulesBrief(rules.text);
      const result = await requestDraft({
        brief,
        repo: target,
        features: reuse,
        context: briefed ? [{ path: "studio.json", excerpt: briefed }, ...context] : context,
      });
      setPlan(result);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The agent did not answer.");
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    const path = pathToAttach.trim();
    if (!path || !target) return;
    setError("");
    try {
      const content = await readFile(token, target, path);
      if (content === null) {
        setError(`${path} is not in ${target}.`);
        return;
      }
      setContext((current) => [
        ...current.filter((entry) => entry.path !== path),
        { path, excerpt: content.slice(0, 4000) },
      ]);
      setPathToAttach("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read that file.");
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

      <div className="rules">
        <h3 style={{ marginTop: 0 }}>Project rules</h3>
        {!rules.checked && <p className="muted small">Looking for studio.json…</p>}
        {rules.checked && rules.text && (
          <p className="muted small">
            Reading <code>studio.json</code> — {rulesBrief(rules.text).split("\n").length} lines of context will go to the
            agent.
          </p>
        )}
        {rules.checked && !rules.text && (
          <>
            <p className="muted small">
              This project has no <code>studio.json</code>. Adding one gives the agent its stack, its hard rules and its
              design notes instead of guessing.
            </p>
            <button className="btn" onClick={createRules} disabled={busy}>Create studio.json (opens a PR)</button>
          </>
        )}
      </div>

      <label htmlFor="attach">Give the agent real code (optional)</label>
      <div className="attach-row">
        <input
          id="attach"
          value={pathToAttach}
          onChange={(event) => setPathToAttach(event.target.value)}
          placeholder="src/components/Booking.tsx"
        />
        <button className="btn" onClick={attach} disabled={!pathToAttach.trim()}>Attach file</button>
      </div>
      {!!context.length && (
        <ul className="attached">
          {context.map((entry) => (
            <li key={entry.path}>
              <code>{entry.path}</code>
              <span className="muted small"> · {entry.excerpt.length.toLocaleString("en-GB")} chars</span>
              <button
                className="link"
                onClick={() => setContext((current) => current.filter((item) => item.path !== entry.path))}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Up to a few files, first 4,000 characters each. Files are read at draft time from the selected project's default
        branch.
      </p>

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
