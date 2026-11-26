import { useCallback, useEffect, useState } from "react";
import { loadAnythingList, loadAnythingProject, type AnythingApp } from "../anythingClient";
import { scan, scanLine } from "../anythingScan";
import type { AnythingMe, AnythingProject } from "../anything";

type State =
  | { kind: "loading" }
  | { kind: "off"; reason: string }
  | { kind: "ready"; me: AnythingMe | null; projects: AnythingProject[] };

/**
 * The build-time inventory, on the clipboard.
 *
 * This is the one way to get the real inventory out of a deployment whose key
 * cannot be read back: the build read it, so the browser already has it, and a
 * paste is a smaller favour than a secret.
 */
function ScanButton({ extra }: { extra: () => unknown }) {
  const [said, setSaid] = useState("");
  return (
    <>
      <button
        className="btn ghost small-btn"
        type="button"
        title={scanLine()}
        onClick={() => {
          const json = JSON.stringify({ scan, ...(extra() as Record<string, unknown>) }, null, 2);
          void navigator.clipboard?.writeText(json).then(
            () => setSaid("Inventory copied — paste it anywhere."),
            () => setSaid("The browser refused the clipboard.")
          );
        }}
      >
        Copy the scan
      </button>
      {said && <span className="muted small">{said}</span>}
    </>
  );
}

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
 *
 * The list is every project the API will hand over (it is asked for 100). What is
 * *inside* a project is a second request per project, so it is made when you open
 * one — a list that waits for a hundred detail calls is a list that never appears.
 */
export function Anything() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { kind: "busy" } | { kind: "done"; app: AnythingApp } | { kind: "failed"; reason: string }>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void loadAnythingList({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setState({ kind: "ready", me: result.me, projects: result.projects });
      else setState({ kind: "off", reason: result.reason });
    });
    return () => controller.abort();
  }, [reload]);

  const inspect = useCallback(
    (project: AnythingProject) => {
      setOpen((current) => (current === project.id ? null : project.id));
      setDetails((current) => {
        const seen = current[project.id];
        if (seen && seen.kind !== "failed") return current;
        const next = { ...current, [project.id]: { kind: "busy" as const } };
        void loadAnythingProject(project).then((result) => {
          setDetails((latest) => ({
            ...latest,
            [project.id]: result.ok ? { kind: "done", app: result.app } : { kind: "failed", reason: result.reason },
          }));
        });
        return next;
      });
    },
    []
  );

  if (state.kind === "loading") return <p className="muted">Asking Anything for your projects…</p>;

  if (state.kind === "off")
    return (
      <div className="panel">
        <p className="eyebrow">Anything</p>
        <h2>Not connected</h2>
        <p className="muted">{state.reason}</p>
        <p className="muted small">
          <a href="/api/anything?probe=1" target="_blank" rel="noreferrer">
            What each stored key answers
          </a>{" "}
          — the diagnostic names the variables, their lengths and what Anything says about them, and never prints a key.
        </p>
        <p className="muted small">
          The key goes in Vercel → project <strong>studio</strong> → Settings → Environment Variables as{" "}
          <code>ANYTHING_API_KEY</code> (or <code>Anything_Key</code>), type Sensitive, then redeploy. It is read as a
          read-only credential: this tab only ever lists projects and reads what is inside one, it never creates,
          renames or deletes anything.
        </p>
        <p className="muted small">{scanLine()}</p>
        <div className="row-actions">
          <button className="btn ghost" type="button" onClick={() => setReload((count) => count + 1)}>
            Try again
          </button>
          <ScanButton extra={() => ({ tab: [] })} />
        </div>
      </div>
    );

  const needle = query.trim().toLowerCase();
  const projects = needle
    ? state.projects.filter(
        (project) => project.name.toLowerCase().includes(needle) || project.organizationName.toLowerCase().includes(needle)
      )
    : state.projects;
  const credits = state.me?.organizations.reduce((total, org) => total + (org.creditsBalance ?? 0), 0) ?? null;
  const organisations = [...new Set(state.projects.map((project) => project.organizationName))];

  return (
    <div className="anything">
      <div className="shelf-head">
        <h2>
          {projects.length === state.projects.length
            ? `${state.projects.length} project${state.projects.length === 1 ? "" : "s"}`
            : `${projects.length} of ${state.projects.length}`}
        </h2>
        {credits !== null && <span className="pill">{credits.toLocaleString("en-GB")} credits</span>}
        {state.me?.email && <span className="muted small">{state.me.email}</span>}
        <input
          className="anything-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or organisation"
          aria-label="Filter Anything projects"
        />
        <button className="btn ghost small-btn" type="button" onClick={() => setReload((count) => count + 1)}>
          Refresh
        </button>
        <ScanButton
          extra={() => ({
            tab: state.projects.map((project) => {
              const loaded = details[project.id];
              return {
                id: project.id,
                name: project.name,
                organization: project.organizationName,
                updatedAt: project.updatedAt,
                parts: loaded?.kind === "done" ? loaded.app.modules : null,
              };
            }),
          })}
        />
      </div>

      {organisations.length > 1 && (
        <p className="muted small">
          Organisations: {organisations.join(" · ")}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="muted">
          {state.projects.length === 0
            ? "That account has no projects yet. Anything makes one from a sentence."
            : `Nothing matched. Clear the filter to see all ${state.projects.length}.`}
        </p>
      ) : (
        <ul className="anything-list">
          {projects.map((project) => {
            const detail = details[project.id];
            const expanded = open === project.id;
            return (
              <li key={project.id} className={expanded ? "is-open" : undefined}>
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
                    aria-expanded={expanded}
                    onClick={() => inspect(project)}
                  >
                    {expanded ? "Hide what's in it" : "What's in it"}
                  </button>
                  {detail?.kind === "done" && detail.app.url && (
                    <a className="btn ghost small-btn" href={detail.app.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  )}
                  <button
                    className="btn ghost small-btn"
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(project.id).catch(() => undefined)}
                    title={project.id}
                  >
                    Copy ID
                  </button>
                </div>

                {expanded && (
                  <div className="anything-detail">
                    {(!detail || detail.kind === "busy") && <p className="muted small">Reading what is in it…</p>}
                    {detail?.kind === "failed" && <p className="muted small">That project could not be read: {detail.reason}</p>}
                    {detail?.kind === "done" && (
                      <>
                        <p className="muted small">
                          {detail.app.platform}
                          {detail.app.url ? " · published" : " · not published yet"}
                        </p>
                        {detail.app.modules.length ? (
                          <ul className="anything-modules">
                            {detail.app.modules.map((module) => (
                              <li key={module}>{module}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">The API lists no files for this project yet.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="muted small">
        Read-only: this deployment holds an Anything API key and reads two things with it — the list of projects (asked
        for 100 at a time, the API's own ceiling) and, when you open one, its files and published URL. Creating,
        renaming or deleting still happens on anything.com, where you can see what you are doing. Each project also
        appears in the <strong>Atlas</strong> as a sun, once it can be read.
      </p>
    </div>
  );
}
