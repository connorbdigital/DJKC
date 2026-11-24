import { useEffect, useState } from "react";
import { ME_PATH, PROJECTS_PATH, type AnythingMe, type AnythingProject } from "../anything";

type State =
  | { kind: "loading" }
  | { kind: "off"; reason: string }
  | { kind: "ready"; me: AnythingMe | null; projects: AnythingProject[] };

const call = async <T,>(path: string): Promise<T> => {
  const response = await fetch("/api/anything", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  return body as T;
};

const when = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * Anything's projects, read through this deployment.
 *
 * The key lives on the server and never reaches this component: a rejected key
 * and a missing key look different here on purpose, because the fix is different.
 */
export function Anything() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [me, list] = await Promise.all([
          call<AnythingMe>(ME_PATH).catch(() => null),
          call<{ projects: AnythingProject[] }>(`${PROJECTS_PATH}?limit=100`),
        ]);
        if (!live) return;
        setState({ kind: "ready", me, projects: list.projects ?? [] });
      } catch (problem) {
        if (!live) return;
        setState({ kind: "off", reason: problem instanceof Error ? problem.message : "Anything did not answer." });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === "loading") return <p className="muted">Asking Anything for your projects…</p>;

  if (state.kind === "off")
    return (
      <div className="panel">
        <p className="eyebrow">Anything</p>
        <h2>Not connected yet</h2>
        <p className="muted">{state.reason}</p>
        <p className="muted small">
          The key goes in Vercel → project <strong>studio</strong> → Settings → Environment Variables as{" "}
          <code>ANYTHING_API_KEY</code>, type Sensitive, then redeploy. It is read as a read-only credential: this tab
          only ever lists projects, it never creates, renames or deletes one.
        </p>
      </div>
    );

  const needle = query.trim().toLowerCase();
  const projects = needle
    ? state.projects.filter(
        (project) =>
          project.name.toLowerCase().includes(needle) || project.organizationName.toLowerCase().includes(needle)
      )
    : state.projects;
  const credits = state.me?.organizations.reduce((total, org) => total + (org.creditsBalance ?? 0), 0) ?? null;

  return (
    <div className="anything">
      <div className="shelf-head">
        <h2>{projects.length} projects</h2>
        {credits !== null && <span className="pill">{credits.toLocaleString("en-GB")} credits</span>}
        {state.me?.email && <span className="muted small">{state.me.email}</span>}
        <input
          className="anything-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or organisation"
          aria-label="Filter Anything projects"
        />
        <a className="btn ghost small-btn" href="https://www.anything.com" target="_blank" rel="noopener noreferrer">
          Open Anything
        </a>
      </div>

      {projects.length === 0 ? (
        <p className="muted">Nothing matched. Clear the filter to see all {state.projects.length}.</p>
      ) : (
        <ul className="anything-list">
          {projects.map((project) => (
            <li key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <p className="muted small">
                  {project.organizationName}
                  {project.slug ? ` · ${project.slug}` : ""}
                </p>
              </div>
              <div className="anything-meta">
                <span className="tag">updated {when(project.updatedAt)}</span>
                <button
                  className="btn ghost small-btn"
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(project.id).catch(() => undefined)}
                  title={project.id}
                >
                  Copy ID
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small">
        Read-only: this deployment holds an Anything API key and can list projects with it. Creating, renaming or
        deleting a project still happens on anything.com, where you can see what you are doing.
      </p>
    </div>
  );
}
