import { useCallback, useEffect, useState } from "react";
import { listRepos, whoami } from "./github";
import { clearToken, getToken, setToken } from "./token";
import type { Repo } from "./types";
import { Gate } from "./components/Gate";
import { Projects } from "./components/Projects";
import { Features } from "./components/Features";
import { Packs } from "./components/Packs";
import { Draft } from "./components/Draft";

type Tab = "projects" | "packs" | "features" | "draft";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "projects", label: "Projects", blurb: "Everything on the account, newest first, with its history." },
  { id: "packs", label: "Packs", blurb: "Whole setups — a working site in one pull request, dependencies included." },
  { id: "features", label: "Feature library", blurb: "What already ships, ready to copy into another project." },
  { id: "draft", label: "Agent", blurb: "Describe the change; the agent drafts files; you review and open the pull request." },
];

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [login, setLogin] = useState<string>("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("projects");

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const [me, list] = await Promise.all([whoami(value), listRepos(value)]);
      setLogin(me.login);
      setRepos(list);
    } catch (problem) {
      setRepos(null);
      setError(problem instanceof Error ? problem.message : "GitHub did not answer.");
      clearToken();
      setTokenState("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const unlock = (value: string) => {
    setToken(value);
    setTokenState(value);
  };

  const lock = () => {
    clearToken();
    setTokenState("");
    setRepos(null);
    setLogin("");
  };

  if (!token) return <Gate onSubmit={unlock} error={error} />;

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>Projects, features and agents</h1>
        </div>
        <div className="top-actions">
          {login && <span className="pill">{login}</span>}
          <button className="btn ghost" onClick={lock}>Lock</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Studio sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={`tab${tab === entry.id ? " is-on" : ""}`}
            aria-current={tab === entry.id ? "page" : undefined}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <p className="lede">{active.blurb}</p>

      {loading && <p className="muted">Reading GitHub…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {repos && tab === "projects" && <Projects token={token} repos={repos} />}
      {repos && tab === "packs" && <Packs token={token} repos={repos} />}
      {repos && tab === "features" && <Features token={token} repos={repos} />}
      {repos && tab === "draft" && <Draft token={token} repos={repos} />}

      <footer className="foot">
        <p>
          The token lives in this tab only — closing it locks the studio. Nothing here merges a pull request, deploys, or
          runs your code: every change is opened for review.
        </p>
      </footer>
    </div>
  );
}
