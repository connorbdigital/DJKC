import { useEffect, useState } from "react";
import { loadAnythingApps, type AnythingApp } from "../anythingClient";
import type { AnythingMe } from "../anything";

type State =
  | { kind: "loading" }
  | { kind: "off"; reason: string }
  | { kind: "ready"; me: AnythingMe | null; apps: AnythingApp[] };

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
    const controller = new AbortController();
    void loadAnythingApps({ limit: 24, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setState({ kind: "ready", me: result.me, apps: result.apps });
      else setState({ kind: "off", reason: result.reason });
    });
    return () => controller.abort();
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
          <code>ANYTHING_API_KEY</code> (or <code>Anything_Key</code>), type Sensitive, then redeploy. It is read as a
          read-only credential: this tab only ever lists projects and reads what is inside one, it never creates,
          renames or deletes anything.
        </p>
      </div>
    );

  const needle = query.trim().toLowerCase();
  const apps = needle
    ? state.apps.filter(
        (app) => app.name.toLowerCase().includes(needle) || app.organizationName.toLowerCase().includes(needle)
      )
    : state.apps;
  const credits = state.me?.organizations.reduce((total, org) => total + (org.creditsBalance ?? 0), 0) ?? null;

  return (
    <div className="anything">
      <div className="shelf-head">
        <h2>
          {apps.length} project{apps.length === 1 ? "" : "s"}
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
        <a className="btn ghost small-btn" href="https://www.anything.com" target="_blank" rel="noopener noreferrer">
          Open Anything
        </a>
      </div>

      {apps.length === 0 ? (
        <p className="muted">
          {state.apps.length === 0
            ? "That account has no projects yet. Anything makes one from a sentence."
            : `Nothing matched. Clear the filter to see all ${state.apps.length}.`}
        </p>
      ) : (
        <ul className="anything-list">
          {apps.map((app) => (
            <li key={app.id}>
              <div>
                <strong>{app.name}</strong>
                <p className="muted small">
                  {app.organizationName} · {app.platform}
                  {app.modules.length ? ` · ${app.modules.length} modules` : ""}
                </p>
              </div>
              <div className="anything-meta">
                <span className="tag">updated {when(app.updatedAt)}</span>
                {app.url && (
                  <a className="btn ghost small-btn" href={app.url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                )}
                <button
                  className="btn ghost small-btn"
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(app.id).catch(() => undefined)}
                  title={app.id}
                >
                  Copy ID
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small">
        Read-only: this deployment holds an Anything API key and reads two things with it — the list of projects, and
        one project's modules and published URL. Creating, renaming or deleting still happens on anything.com, where
        you can see what you are doing. Each project also appears in the{" "}
        <strong>Atlas</strong> as a sun, once it can be read.
      </p>
    </div>
  );
}
