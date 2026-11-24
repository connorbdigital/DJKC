import { useEffect, useMemo, useState } from "react";
import { activity, listTree, readFile } from "../github";
import { summariseInventory, takeInventory, type Inventory } from "../inventory";
import type { ActivityEvent, Repo } from "../types";

const when = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? iso : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function Projects({ token, repos }: { token: string; repos: Repo[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(repos[0]?.fullName ?? "");
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState("");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [inventoryError, setInventoryError] = useState("");
  const [copied, setCopied] = useState(false);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? repos.filter((repo) => `${repo.fullName} ${repo.description ?? ""}`.toLowerCase().includes(term)) : repos;
  }, [query, repos]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setEvents(null);
    setError("");
    activity(token, selected)
      .then((list) => { if (!cancelled) setEvents(list); })
      .catch((problem: unknown) => { if (!cancelled) setError(problem instanceof Error ? problem.message : "Could not read that history."); });
    return () => { cancelled = true; };
  }, [token, selected]);

  /* What is actually in the repository, not what it says about itself. */
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setInventory(null);
    setInventoryError("");
    setCopied(false);
    const run = async () => {
      try {
        const repo = repos.find((entry) => entry.fullName === selected);
        const branch = repo?.defaultBranch ?? "main";
        const tree = await listTree(token, selected, branch);
        const [packageJson, manifest] = await Promise.all([
          readFile(token, selected, "package.json", branch),
          readFile(token, selected, "studio/features.json", branch),
        ]);
        if (!cancelled) setInventory(takeInventory({ ...tree, packageJson, manifest }));
      } catch (problem) {
        if (!cancelled) setInventoryError(problem instanceof Error ? problem.message : "Could not read the file list.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, selected, repos]);

  const repo = repos.find((entry) => entry.fullName === selected);

  const copySummary = async () => {
    if (!inventory || !repo) return;
    try {
      await navigator.clipboard.writeText(summariseInventory(repo.fullName, inventory));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="split">
      <div className="col">
        <input
          className="input"
          placeholder={`Search ${repos.length} repositories`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search repositories"
        />
        <ul className="list">
          {shown.map((entry) => (
            <li key={entry.id}>
              <button
                className={`list-item${entry.fullName === selected ? " is-on" : ""}`}
                onClick={() => setSelected(entry.fullName)}
              >
                <span className="list-title">{entry.name}<span className="muted"> · {entry.owner}</span></span>
                <span className="muted small">
                  {entry.private ? "private" : "public"}
                  {entry.language ? ` · ${entry.language}` : ""} · {when(entry.updatedAt)}
                </span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="muted">Nothing matches that.</li>}
        </ul>
      </div>

      <div className="col">
        {repo && (
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{repo.name}</h2>
                <p className="muted">{repo.description ?? "No description."}</p>
              </div>
              <a className="btn ghost" href={repo.htmlUrl} target="_blank" rel="noreferrer">Open on GitHub</a>
            </div>
            <p className="muted small">
              Default branch <code>{repo.defaultBranch}</code> · updated {when(repo.updatedAt)}
            </p>
            <h3>What is in it</h3>
            {inventoryError && <p className="error" role="alert">{inventoryError}</p>}
            {!inventory && !inventoryError && <p className="muted small">Reading the file list…</p>}
            {inventory && (
              <div className="inventory">
                <div className="chips">
                  {inventory.stack.map((entry) => (
                    <span className="badge" key={entry}>{entry}</span>
                  ))}
                  <span className="badge">{inventory.files} files</span>
                  <span className="badge">{inventory.apiRoutes.length} routes</span>
                  <span className="badge">{inventory.pages.length} pages</span>
                  <span className="badge">{inventory.componentCount} components</span>
                  <span className="badge">{inventory.testCount} tests</span>
                </div>

                {!!inventory.features.length && (
                  <>
                    <h4>Known features present</h4>
                    <ul className="files">
                      {inventory.features.map((feature) => (
                        <li key={feature.id}>
                          <strong>{feature.name}</strong>
                          {feature.unrecorded ? (
                            <span className="badge warn">unrecorded</span>
                          ) : (
                            <span className="badge good">recorded</span>
                          )}
                          <span className="muted small"> — {feature.evidence.slice(0, 3).join(", ")}{feature.evidence.length > 3 ? ` +${feature.evidence.length - 3}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {!!inventory.apiRoutes.length && (
                  <>
                    <h4>Routes</h4>
                    <p className="mono small">{inventory.apiRoutes.join(" · ")}</p>
                  </>
                )}

                {!!inventory.pages.length && (
                  <>
                    <h4>Pages</h4>
                    <p className="mono small">{inventory.pages.slice(0, 12).join(" · ")}</p>
                  </>
                )}

                {!!inventory.env.length && (
                  <>
                    <h4>Environment it expects</h4>
                    <p className="mono small">{inventory.env.join(" · ")}</p>
                  </>
                )}

                {!!inventory.notes.length && (
                  <ul className="notes">
                    {inventory.notes.map((note) => (
                      <li key={note} className="muted small">{note}</li>
                    ))}
                  </ul>
                )}

                <button className="btn ghost" onClick={copySummary}>
                  {copied ? "Copied" : "Copy a summary for a brief"}
                </button>
              </div>
            )}

            <h3>History</h3>
            {error && <p className="error" role="alert">{error}</p>}
            {!events && !error && <p className="muted">Reading commits and pull requests…</p>}
            <ol className="timeline">
              {(events ?? []).map((event) => (
                <li key={`${event.kind}-${event.id}-${event.at}`} className={`event ${event.kind}`}>
                  <span className="badge">
                    {event.kind === "pull" ? (event.merged ? "merged" : event.state) : "commit"}
                  </span>
                  <a href={event.url} target="_blank" rel="noreferrer">{event.title}</a>
                  <span className="muted small">
                    {event.kind === "pull" ? `${event.id} · ` : ""}
                    {event.author} · {when(event.at)}
                  </span>
                </li>
              ))}
            </ol>
            {events?.length === 0 && <p className="muted">Nothing in this repository yet — it is ready for its first build.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
