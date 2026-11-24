import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { listRepos, whoami } from "./github";
import { clearToken, getToken, setToken } from "./token";
import { PROXY_TOKEN, probeProxy } from "./proxy";
import type { Repo } from "./types";
import { Gate } from "./components/Gate";
import { Projects } from "./components/Projects";
import { Features } from "./components/Features";
import { Packs } from "./components/Packs";
import { Search } from "./components/Search";
import { Draft } from "./components/Draft";
import { Resources } from "./components/Resources";
import { Anything } from "./components/Anything";
/* three.js is ~700kB; nobody pays for it until they ask for the space. */
const Atlas = lazy(() => import("./components/Atlas").then((module) => ({ default: module.Atlas })));

type Tab = "projects" | "packs" | "features" | "search" | "draft" | "resources" | "anything" | "atlas";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "projects", label: "Projects", blurb: "Everything on the account, newest first, with its history." },
  { id: "packs", label: "Packs", blurb: "Whole setups — a working site in one pull request, dependencies included." },
  { id: "features", label: "Feature library", blurb: "What already ships, ready to copy into another project." },
  { id: "search", label: "Search", blurb: "Look inside every project, and at one public page outside them." },
  { id: "draft", label: "Agent", blurb: "Describe the change; the agent drafts files; you review and open the pull request." },
  {
    id: "anything",
    label: "Anything",
    blurb: "The projects you built on anything.com, read with this deployment's key — listed, never changed.",
  },
  {
    id: "resources",
    label: "Shelf",
    blurb: "The todo, the sourcing links, and every key the two deployed projects read.",
  },
  {
    id: "atlas",
    label: "Atlas (3D)",
    blurb: "Fly through every project, process, pathway and blog post at once. Works with the keyboard, and in a headset where one is attached.",
  },
];

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [login, setLogin] = useState<string>("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("projects");
  const [preview, setPreview] = useState(false);
  /* null = still asking. A deployment with GITHUB_TOKEN set can read without a
     token, so the gate has to wait for the answer rather than flash. */
  const [proxy, setProxy] = useState<"unknown" | "yes" | "no">("unknown");
  /* "Use my token" has to survive the probe, or the server key would win it back. */
  const [wantsToken, setWantsToken] = useState(false);

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

  useEffect(() => {
    if (token || wantsToken) return;
    let live = true;
    void probeProxy().then((identity) => {
      if (!live) return;
      setProxy(identity ? "yes" : "no");
      if (identity) {
        setLogin(identity.login);
        setTokenState(PROXY_TOKEN);
      }
    });
    return () => {
      live = false;
    };
  }, [token, wantsToken]);

  const unlock = (value: string) => {
    setToken(value);
    setTokenState(value);
  };

  const lock = () => {
    clearToken();
    setTokenState("");
    setRepos(null);
    setLogin("");
    /* Leaving the server key behind on purpose: the gate is the next screen. */
    if (proxy === "yes") {
      setWantsToken(true);
      setProxy("no");
    }
  };

  if (!token && preview)
    return (
      <Suspense fallback={<p className="atlas-boot">Loading the space…</p>}>
        <Atlas onClose={() => setPreview(false)} />
      </Suspense>
    );

  if (!token && proxy === "unknown") return <p className="atlas-boot">Checking this deployment…</p>;
  if (!token) return <Gate onSubmit={unlock} error={error} onPreview={() => setPreview(true)} />;

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>Projects, features and agents</h1>
        </div>
        <div className="top-actions">
          {login && <span className="pill">{token === PROXY_TOKEN ? `${login} · server key` : login}</span>}
          <button className="btn ghost" onClick={lock}>{token === PROXY_TOKEN ? "Use my token" : "Lock"}</button>
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
      {repos && tab === "search" && <Search token={token} repos={repos} login={login} />}
      {repos && tab === "draft" && <Draft token={token} repos={repos} />}
      {/* The shelf needs no token and no network: it is the same on a bad day. */}
      {tab === "resources" && <Resources />}
      {tab === "anything" && <Anything />}
      {tab === "atlas" && (
        <Suspense fallback={<p className="atlas-boot">Loading the space…</p>}>
          <Atlas onClose={() => setTab("projects")} />
        </Suspense>
      )}

      <footer className="foot">
        <p>
          {token === PROXY_TOKEN
            ? "Reading GitHub with this deployment's own key: it stays on the server, GET only, and nothing here writes to a repository without a token of your own."
            : "The token lives in this tab only — closing it locks the studio."}{" "}
          Nothing here merges a pull request, deploys, or runs your code: every change is opened for review.
        </p>
      </footer>
    </div>
  );
}
