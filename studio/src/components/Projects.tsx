import { useEffect, useMemo, useState } from "react";
import { activity } from "../github";
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

  const repo = repos.find((entry) => entry.fullName === selected);

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
