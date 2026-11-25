import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { GithubError, listRepos, whoami } from "./github";
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
import { Standards } from "./components/Standards";
import { Pitch } from "./components/Pitch";
import { Anything } from "./components/Anything";
import { Palette } from "./components/Palette";
import type { Command } from "./palette";
import { PROJECTS } from "./atlas";
/* three.js is ~700kB; nobody pays for it until they ask for the space. */
const Atlas = lazy(() => import("./components/Atlas").then((module) => ({ default: module.Atlas })));

type Tab = "projects" | "packs" | "features" | "search" | "draft" | "standards" | "pitch" | "resources" | "anything" | "atlas";

/** `#tab=shelf` opens that tab, and `#atlas/<node>` has to open the space.
 *  A link you cannot share is a link you have to describe instead. */
function tabFromHash(hash: string): Tab {
  const wanted = hash.replace(/^#/, "");
  if (wanted.startsWith("atlas/")) return "atlas";
  const named = wanted.startsWith("tab=") ? wanted.slice(4) : wanted;
  return TABS.some((entry) => entry.id === named) ? (named as Tab) : "projects";
}

/** Three groups: a list of tabs in a row is a row, not a way around. */
type Group = "build" | "ask" | "look";

const GROUPS: { id: Group; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "ask", label: "Ask and read" },
  { id: "look", label: "Look around" },
];

const TABS: { id: Tab; label: string; blurb: string; group: Group; glyph: string }[] = [
  { id: "projects", label: "Projects", group: "build", glyph: "▦", blurb: "Everything on the account, newest first, with its history." },
  { id: "packs", label: "Packs", group: "build", glyph: "▤", blurb: "Whole setups — a working site in one pull request, dependencies included." },
  { id: "features", label: "Feature library", group: "build", glyph: "◈", blurb: "What already ships, ready to copy into another project." },
  { id: "search", label: "Search", group: "ask", glyph: "⌕", blurb: "Look inside every project, and at one public page outside them." },
  { id: "draft", label: "Agent", group: "ask", glyph: "✎", blurb: "Describe the change; the agent drafts files; you review and open the pull request." },
  {
    id: "standards",
    label: "Standards",
    group: "build",
    glyph: "✓",
    blurb: "Everything a website should have, scored against the shop and the band — with the gaps named and the two best examples of each line.",
  },
  {
    id: "pitch",
    label: "Pitch sheet",
    group: "ask",
    glyph: "◫",
    blurb: "A prospect's URL in, a one-page audit out: five faults, what each costs, what to do first, and the package that fits. Print it or paste it.",
  },
  {
    id: "anything",
    label: "Anything",
    group: "ask",
    glyph: "✧",
    blurb: "The projects you built on anything.com, read with this deployment's key — listed, never changed.",
  },
  {
    id: "resources",
    label: "Shelf",
    group: "look",
    glyph: "☰",
    blurb: "The todo, the sourcing links, and every key the two deployed projects read.",
  },
  {
    id: "atlas",
    label: "Atlas (3D)",
    group: "look",
    glyph: "✷",
    blurb: "Fly through every project, process, pathway and blog post at once. Works with the keyboard, and in a headset where one is attached.",
  },
];

/** The tabs that read GitHub, and so the only ones that want a key. */
const REPO_TABS = new Set<Tab>(["projects", "packs", "features", "search", "draft"]);

/**
 * The key, asked for where it is used rather than at the door: a person reading
 * the shelf should not have to produce a token to find out what the shelf is.
 */
function KeyNeeded({ onSubmit, error, tab }: { onSubmit: (token: string) => void; error: string; tab: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="key-needed">
      <p className="eyebrow">{tab}</p>
      <h2>This tab reads your repositories</h2>
      <p className="muted">
        A fine-grained token with read access is enough. It lives in this tab's sessionStorage and is gone when you
        close the tab. Every other tab in the Studio works without one.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim().length < 10) return;
          onSubmit(value.trim());
        }}
      >
        <label htmlFor="inline-token">Token</label>
        <input
          id="inline-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="github_pat_…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="btn primary" type="submit">Unlock this tab</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted small">
        Create one at GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
      </p>
    </div>
  );
}

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [login, setLogin] = useState<string>("");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>(() =>
    typeof window === "undefined" ? "projects" : tabFromHash(window.location.hash)
  );
  const [preview, setPreview] = useState(false);
  /* The Studio is not the gate. The Atlas, the shelf and the notes need no key,
     so a visit without one lands in the Studio on a tab that works, and the
     repository tabs ask for the key when — and only when — you reach them. */
  const [browsing, setBrowsing] = useState(false);
  const [returnTab, setReturnTab] = useState<Tab>("projects");
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
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
      /* A rejected token is a token problem, and the gate is the right answer.
         A rate limit, a proxy hiccup or a dead connection is not: forgetting the
         token for those dropped people at the gate in the middle of the work,
         which is how "click anything and it asks for the token again" happened. */
      const status = problem instanceof GithubError ? problem.status : 0;
      if (status === 401) {
        clearToken();
        setTokenState("");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* The shell is cached, so the Studio still opens offline — and says so. */
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  /* A drawer on a phone: escape closes it, and the page behind it must not scroll. */
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menu]);

  /* ⌘K on a Mac, Ctrl-K everywhere else, and the button in the header for thumbs. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* A link clicked while the studio is already open has to land as well. */
  useEffect(() => {
    const sync = () => setTab((current) => {
      const named = tabFromHash(window.location.hash);
      return named === current ? current : named;
    });
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  /* The hash names the tab, so a link can point at one. The Atlas owns the hash
     while you are inside it (`#atlas/<node>`), so it is left alone there. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    /* While the space is open it owns the hash (`#atlas/<node>`); leave it alone
       there, but going back to a tab has to replace the node link. */
    if ((tab === "atlas" && hash.startsWith("atlas/")) || hash === `tab=${tab}`) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#tab=${tab}`);
  }, [tab]);

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

  if (!token && proxy === "unknown") return <p className="atlas-boot">Checking this deployment…</p>;
  if (!token && !browsing && preview)
    return (
      <Suspense fallback={<p className="atlas-boot">Loading the space…</p>}>
        <Atlas onClose={() => setPreview(false)} />
      </Suspense>
    );
  if (!token && !browsing) {
    return (
      <Gate
        onSubmit={unlock}
        error={error}
        onPreview={() => setPreview(true)}
        onBrowse={() => {
          setBrowsing(true);
          /* A tab that reads GitHub would be a prompt with nothing behind it. */
          if (REPO_TABS.has(tab)) setTab("resources");
        }}
      />
    );
  }

  /* Everything below here renders with or without a key. */

  const active = TABS.find((t) => t.id === tab)!;

  const commands: Command[] = [
    ...TABS.map((entry) => ({
      id: `tab-${entry.id}`,
      label: entry.label,
      hint: tab === entry.id ? "you are here" : "tab",
      aliases: [entry.blurb],
      run: () => setTab(entry.id),
    })),
    ...PROJECTS.map((project) => ({
      id: `node-${project.id}`,
      label: `${project.label} — open in the space`,
      hint: "Atlas",
      run: () => {
        setTab("atlas");
        window.location.hash = `atlas/${project.id}`;
      },
    })),
    { id: "lock", label: "Lock the studio", hint: "forget the token", run: lock },
  ];

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>Projects, features and agents</h1>
        </div>
        <div className="top-actions">
          <button
            className="btn ghost menu-toggle"
            type="button"
            aria-expanded={menu}
            aria-controls="studio-menu"
            onClick={() => setMenu((open) => !open)}
          >
            <span aria-hidden="true">☰</span> Menu
          </button>
          <button className="btn ghost palette-open" onClick={() => setPalette(true)} aria-label="Open the command palette">
            ⌘K
          </button>
          {!online && <span className="pill pill-offline">Offline — the space and the shelf still work</span>}
          {login && <span className="pill">{token === PROXY_TOKEN ? `${login} · server key` : login}</span>}
          {!token && <span className="pill">no key — repository tabs ask when you reach them</span>}
          <button className="btn ghost" onClick={lock}>{token === PROXY_TOKEN ? "Use my token" : "Lock"}</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Studio sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={`tab${tab === entry.id ? " is-on" : ""}`}
            aria-current={tab === entry.id ? "page" : undefined}
            onClick={() => {
              if (tab !== "atlas") setReturnTab(tab);
              setTab(entry.id);
            }}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {menu && (
        <>
          <div className="menu-scrim" role="presentation" onClick={() => setMenu(false)} />
          <aside id="studio-menu" className="studio-menu" aria-label="Studio menu">
            <div className="studio-menu-head">
              <p className="eyebrow">Studio</p>
              <button className="btn ghost" type="button" onClick={() => setMenu(false)} aria-label="Close menu">
                ×
              </button>
            </div>
            {GROUPS.map((group) => (
              <div className="studio-menu-group" key={group.id}>
                <p className="studio-menu-label">{group.label}</p>
                {TABS.filter((entry) => entry.group === group.id).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`studio-menu-item${tab === entry.id ? " is-on" : ""}`}
                    aria-current={tab === entry.id ? "page" : undefined}
                    onClick={() => {
                      setTab(entry.id);
                      setMenu(false);
                    }}
                  >
                    <span className="studio-menu-glyph" aria-hidden="true">
                      {entry.glyph}
                    </span>
                    <span>
                      <strong>{entry.label}</strong>
                      <span className="studio-menu-blurb">{entry.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            <div className="studio-menu-foot">
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setMenu(false);
                  setPalette(true);
                }}
              >
                Search everything
              </button>
              <button className="btn ghost" type="button" onClick={lock}>
                {token === PROXY_TOKEN ? "Use my token" : "Lock"}
              </button>
            </div>
          </aside>
        </>
      )}

      <p className="lede">{active.blurb}</p>

      {loading && <p className="muted">Reading GitHub…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {!token && REPO_TABS.has(tab) && <KeyNeeded onSubmit={unlock} error={error} tab={active.label} />}
      {repos && tab === "projects" && <Projects token={token} repos={repos} />}
      {repos && tab === "packs" && <Packs token={token} repos={repos} />}
      {repos && tab === "features" && <Features token={token} repos={repos} />}
      {repos && tab === "search" && <Search token={token} repos={repos} login={login} />}
      {repos && tab === "draft" && <Draft token={token} repos={repos} />}
      {/* The shelf needs no token and no network: it is the same on a bad day. */}
      {tab === "resources" && <Resources />}
      {tab === "standards" && <Standards />}
      {tab === "pitch" && <Pitch />}
      {tab === "anything" && <Anything />}
      {tab === "atlas" && (
        <Suspense fallback={<p className="atlas-boot">Loading the space…</p>}>
          <Atlas onClose={() => setTab(token || !REPO_TABS.has(returnTab) ? returnTab : "resources")} />
        </Suspense>
      )}

      {palette && <Palette commands={commands} onClose={() => setPalette(false)} />}

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
