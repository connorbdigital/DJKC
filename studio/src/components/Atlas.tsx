import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtlasEngine } from "../atlasEngine";
import { checkUrl, type SiteReport } from "../sitecheck";
import {
  TOUR,
  auditAtlas,
  buildAtlas,
  customProjectId,
  parseCustomProjects,
  distance,
  hashForNode,
  kindColour,
  nodeFromHash,
  searchAtlas,
  type AtlasNode,
  type AuditFinding,
  type CustomProject,
  type District,
  type NodeKind,
} from "../atlas";

const KIND_DISTRICT: Record<NodeKind, District> = {
  capability: "library",
  pack: "packs",
  step: "builder",
  project: "projects",
  brief: "content",
  site: "gallery",
};

const FILTERS: { id: NodeKind | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "capability", label: "Processes" },
  { id: "pack", label: "Pathways" },
  { id: "project", label: "Projects" },
  { id: "step", label: "Builder" },
  { id: "brief", label: "Blog plan" },
  { id: "site", label: "Sites" },
];

const POSE_KEY = "atlas:pose";
const PROJECTS_KEY = "atlas:projects:v1";

function readProjects(): CustomProject[] {
  try {
    return parseCustomProjects(JSON.parse(window.localStorage.getItem(PROJECTS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeProjects(projects: CustomProject[]) {
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
}

function readPose(): [number, number, number] | null {
  try {
    const raw = window.localStorage.getItem(POSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return parsed as [number, number, number];
    }
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
  return null;
}

/**
 * The Atlas — one space holding the projects, the process library, the packs
 * that install them, the blog plan for sitebuildup.co.uk, and live site panels.
 *
 * It is deliberately usable without a GitHub token: the structure is local data,
 * so a client can be given a link to the space before anyone has signed in.
 * `#atlas/<node id>` opens it looking at that node.
 */
export function Atlas({ onClose }: { onClose?: () => void }) {
  const [ownProjects, setOwnProjects] = useState<CustomProject[]>(() => (typeof window === "undefined" ? [] : readProjects()));
  const atlas = useMemo(() => buildAtlas(ownProjects), [ownProjects]);
  const host = useRef<HTMLDivElement | null>(null);
  const cssHost = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const engine = useRef<AtlasEngine | null>(null);
  const [selected, setSelected] = useState<AtlasNode | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [filter, setFilter] = useState<NodeKind | "all">("all");
  const [position, setPosition] = useState<[number, number, number]>([0, 14, 78]);
  const [district, setDistrict] = useState<District>("library");
  const [near, setNear] = useState<string | null>(null);
  const [heading, setHeading] = useState("S");
  const [vr, setVr] = useState<"unknown" | "ready" | "none">("unknown");
  const [touch, setTouch] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<"none" | "projects" | "audit" | "scan">("none");
  const [scanSite, setScanSite] = useState<AtlasNode | null>(null);
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteReport, setSiteReport] = useState<SiteReport | null>(null);
  const [siteError, setSiteError] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [draft, setDraft] = useState({ label: "", line: "", href: "", stack: "" });
  const savedAt = useRef(0);

  const results = useMemo(() => (query.trim() ? searchAtlas(atlas, query, 8) : []), [atlas, query]);

  useEffect(() => {
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  useEffect(() => {
    if (!host.current || !cssHost.current || !stage.current) return;
    let instance: AtlasEngine | null = null;
    const fromHash = nodeFromHash(window.location.hash, atlas);
    try {
      instance = new AtlasEngine(
        host.current,
        cssHost.current,
        stage.current,
        atlas,
        {
          onSelect: (node) => setSelected(node),
          onHover: (node) => setHovering(Boolean(node)),
          onInteract: () => setTour(null),
          onTick: (info) => {
            setPosition(info.position);
            setDistrict(info.district);
            setNear(info.near);
            setHeading(info.heading);
            /* A page unload does not always run a React cleanup, so the pose is
               written while you fly rather than only when the tab closes. */
            const now = Date.now();
            if (now - savedAt.current > 1000) {
              savedAt.current = now;
              try {
                window.localStorage.setItem(POSE_KEY, JSON.stringify(info.position.map((value) => Math.round(value))));
              } catch {
                /* Storage is a convenience here, never a requirement. */
              }
            }
          },
          onStatus: (message) => setStatus(message),
        },
        fromHash ? null : readPose()
      );
      engine.current = instance;
      setReady(true);
      if (fromHash) {
        instance.flyToId(fromHash.id);
        setSelected(fromHash);
      }
    } catch (problem) {
      setFailed(
        problem instanceof Error
          ? `WebGL did not start: ${problem.message}. The list view below still has everything in the space.`
          : "WebGL did not start in this browser. The list view below still has everything in the space."
      );
    }
    void (navigator as Navigator & { xr?: XRSystem }).xr
      ?.isSessionSupported("immersive-vr")
      .then((supported) => setVr(supported ? "ready" : "none"))
      .catch(() => setVr("none"));
    return () => {
      /* Come back to where you were, not to the entrance. */
      try {
        const pose = instance?.getPose();
        if (pose) window.localStorage.setItem(POSE_KEY, JSON.stringify(pose.map((value) => Math.round(value))));
      } catch {
        /* Private browsing, quota, a locked-down WebView: none of it is fatal. */
      }
      instance?.dispose();
      engine.current = null;
    };
  }, [atlas]);

  useEffect(() => {
    engine.current?.setFilter(filter);
  }, [filter]);

  /* A search should be visible in the dark, not just listed in the HUD. */
  useEffect(() => {
    if (!ready) return;
    if (results.length) engine.current?.highlightNodes(results.map((node) => node.id));
    else engine.current?.clearHighlight();
  }, [results, ready]);

  /* The tour: six stops, one sentence each, and any input hands control back. */
  useEffect(() => {
    if (tour === null) return;
    const stop = TOUR[tour];
    if (!stop) {
      setTour(null);
      return;
    }
    const centre = atlas.districts.find((place) => place.id === stop.district)?.centre;
    if (stop.node) engine.current?.flyToId(stop.node);
    else if (centre) engine.current?.focusDistrict(centre, stop.district === "content" ? 46 : 62);
    const timer = window.setTimeout(() => setTour((current) => (current === null ? null : current + 1)), 4200);
    return () => window.clearTimeout(timer);
  }, [tour, atlas]);

  const flyTo = useCallback((id: string) => {
    engine.current?.flyToId(id);
  }, []);

  const remember = (node: AtlasNode | null) => {
    const next = node ? `${window.location.pathname}${window.location.search}${hashForNode(node.id)}` : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", next);
  };

  const jump = (node: AtlasNode) => {
    flyTo(node.id);
    setSelected(node);
    remember(node);
  };

  const closeDetail = () => {
    setSelected(null);
    remember(null);
  };

  const copyLink = async (node: AtlasNode) => {
    const url = `${window.location.origin}${window.location.pathname}${hashForNode(node.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setStatus(`Copied ${url}`);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setStatus(url);
    }
  };

  const addProject = () => {
    const label = draft.label.trim();
    if (label.length < 2) {
      setStatus("Give the project a name of at least two characters.");
      return;
    }
    const project: CustomProject = {
      id: customProjectId(label),
      label,
      line: draft.line.trim(),
      stack: draft.stack
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      ...(draft.href.trim() ? { href: draft.href.trim() } : {}),
    };
    const next = [...ownProjects.filter((entry) => entry.id !== project.id), project];
    setOwnProjects(next);
    writeProjects(next);
    setDraft({ label: "", line: "", href: "", stack: "" });
    setPanel("none");
    setStatus(`${label} is in the projects district. It lives in this browser, not the repository.`);
  };

  const removeProject = (id: string) => {
    const next = ownProjects.filter((project) => project.id !== id);
    setOwnProjects(next);
    writeProjects(next);
    if (selected?.id === id) closeDetail();
  };

  const openAudit = () => {
    setFindings(auditAtlas(atlas));
    setPanel("audit");
  };

  const openScan = (node: AtlasNode) => {
    setScanSite(node);
    setSiteUrl(node.href ?? "");
    setSiteReport(null);
    setSiteError("");
    setPanel("scan");
  };

  useEffect(() => {
    if (panel === "none") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const runSiteAudit = async () => {
    setSiteError("");
    setSiteReport(null);
    const verdict = checkUrl(siteUrl);
    if (!verdict.ok || !verdict.url) {
      setSiteError(verdict.reason ?? "That URL cannot be checked.");
      return;
    }
    setSiteBusy(true);
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: verdict.url.toString() }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; report: SiteReport }
        | { ok: false; error: string }
        | null;
      if (!data) throw new Error(`The audit endpoint answered ${response.status}.`);
      if (!data.ok) throw new Error(data.error);
      setSiteReport(data.report);
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "The page could not be audited.";
      setSiteError(
        /404|405|unexpected token|failed to fetch|not found/i.test(message)
          ? "The audit runs on the deployed Studio (/api/site), not the dev server. Open the deployed URL to audit a page."
          : message
      );
    } finally {
      setSiteBusy(false);
    }
  };

  const enterVr = async () => {
    if (!engine.current) return;
    try {
      const entered = await engine.current.enterVR();
      setStatus(entered ? "Headset connected. Trigger moves you along the ray; the panels stay on the screen view." : "No headset is connected to this browser.");
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : "The headset session did not start.");
    }
  };

  const goToDistrict = (id: District) => {
    const centre = atlas.districts.find((place) => place.id === id)?.centre;
    if (centre) engine.current?.focusDistrict(centre, id === "content" ? 34 : 58);
  };

  const districtInfo = atlas.districts.find((entry) => entry.id === district);
  const counts = atlas.nodes.reduce<Record<string, number>>((totals, node) => {
    totals[node.kind] = (totals[node.kind] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <div className={`atlas${touch ? " is-touch" : ""}${hovering ? " is-hovering" : ""}`}>
      <div className="atlas-stage" ref={stage}>
        <div ref={host} className="atlas-webgl" />
        <div ref={cssHost} className="atlas-css-host" />
      </div>

      <div className="atlas-hud atlas-top">
        <div className="atlas-title">
          <p className="eyebrow">The Atlas</p>
          <strong>Everything the Studio knows, in one space</strong>
        </div>

        <form
          className="atlas-search"
          onSubmit={(event) => {
            event.preventDefault();
            const [first] = results;
            if (first) jump(first);
            else if (query.trim()) setStatus(`Nothing in the space matches “${query.trim()}”. Try “checkout”, “delivery”, “AI” or “packs”.`);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the space — a process, a pack, a blog post, a site…"
            aria-label="Search the atlas"
            enterKeyHint="go"
          />
          <button className="btn" type="submit">
            Fly to
          </button>
        </form>

        <div className="atlas-actions">
          <button
            className="btn ghost"
            type="button"
            onClick={() => setTour(tour === null ? 0 : null)}
            aria-pressed={tour !== null}
            title="A guided six-stop flythrough"
          >
            {tour === null ? "Tour" : "Stop tour"}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setPanel(panel === "projects" ? "none" : "projects")}
            aria-expanded={panel === "projects"}
            title="Add one of your own projects to the space"
          >
            ＋ Project
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => (panel === "audit" ? setPanel("none") : openAudit())}
            aria-expanded={panel === "audit"}
            title="Check the space and any site for real problems"
          >
            Audit
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void enterVr()}
            disabled={vr !== "ready"}
            title={vr === "ready" ? "Enter the space in a headset" : "No WebXR headset is attached to this browser"}
          >
            {vr === "ready" ? "Enter VR" : vr === "none" ? "No headset" : "VR…"}
          </button>
          {onClose && (
            <button className="btn ghost" type="button" onClick={onClose}>
              Leave
            </button>
          )}
        </div>
      </div>

      <div className="atlas-hud atlas-filters" role="group" aria-label="Show only">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${filter === entry.id ? " is-on" : ""}`}
            aria-pressed={filter === entry.id}
            onClick={() => {
              setFilter(entry.id);
              /* A chip is also a way of travelling: pick the district, go there. */
              if (entry.id !== "all") goToDistrict(KIND_DISTRICT[entry.id]);
            }}
          >
            {entry.label}
            <span>{entry.id === "all" ? atlas.nodes.length : counts[entry.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {query.trim() && !(touch && selected) && (
        <div className="atlas-hud atlas-results">
          {results.length === 0 && <p className="muted">Nothing matches “{query.trim()}”.</p>}
          {results.map((node) => (
            <button key={node.id} type="button" onClick={() => jump(node)}>
              <span className="swatch" style={{ background: kindColour[node.kind] }} />
              <span>
                <strong>{node.label}</strong>
                <small>{node.line.slice(0, 96)}</small>
              </span>
              <em>{distance(position, node.position)}m</em>
            </button>
          ))}
        </div>
      )}

      <div className="atlas-hud atlas-map">
        <svg viewBox="-240 -240 480 480" role="group" aria-label="Map of the space — choose a district">
          <circle cx="0" cy="0" r="230" className="ring" />
          {atlas.districts.map((entry) => (
            <g key={entry.id} className="atlas-map-stop" onClick={() => goToDistrict(entry.id)} role="button" tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") goToDistrict(entry.id);
              }}>
              <title>{entry.label}</title>
              <circle cx={entry.centre[0]} cy={entry.centre[2]} r={district === entry.id ? 13 : 10} className={`district${district === entry.id ? " is-here" : ""}`} />
              <text x={entry.centre[0] + 16} y={entry.centre[2] + 4} className="district-label">
                {entry.label}
              </text>
            </g>
          ))}
          {atlas.nodes
            .filter((node) => ["project", "pack", "brief", "site", "capability"].includes(node.kind))
            .map((node) => (
              <circle
                key={node.id}
                cx={node.position[0]}
                cy={node.position[2]}
                r={node.id === selected?.id ? 5 : 2.4}
                fill={kindColour[node.kind]}
                opacity={node.id === selected?.id ? 1 : 0.7}
              />
            ))}
          <circle cx={position[0]} cy={position[2]} r="6" className="you" />
        </svg>
        <p>
          {districtInfo?.label ?? "Library"} · {heading} · {Math.round(position[0])}, {Math.round(position[2])}
        </p>
      </div>

      {tour !== null && TOUR[tour] && (
        <div className="atlas-hud atlas-tour" role="status">
          <p className="eyebrow">
            Tour · {tour + 1}/{TOUR.length}
          </p>
          <p>{TOUR[tour].caption}</p>
          <div className="atlas-tour-actions">
            <button className="btn ghost" type="button" onClick={() => setTour(tour + 1)}>
              Next
            </button>
            <button className="btn ghost" type="button" onClick={() => setTour(null)}>
              Stop
            </button>
          </div>
        </div>
      )}

      {touch && (
        <div className="atlas-dock">
          <Thumbstick onChange={(vector) => engine.current?.setMoveInput(vector)} />
          <div className="atlas-dock-buttons">
            <button
              className="atlas-pad"
              type="button"
              aria-label="Rise"
              onPointerDown={() => engine.current?.setMoveInput({ lift: 1 })}
              onPointerUp={() => engine.current?.setMoveInput({ lift: 0 })}
              onPointerLeave={() => engine.current?.setMoveInput({ lift: 0 })}
            >
              ↑
            </button>
            <button
              className="atlas-pad"
              type="button"
              aria-label="Drop"
              onPointerDown={() => engine.current?.setMoveInput({ lift: -1 })}
              onPointerUp={() => engine.current?.setMoveInput({ lift: 0 })}
              onPointerLeave={() => engine.current?.setMoveInput({ lift: 0 })}
            >
              ↓
            </button>
            <button
              className="atlas-pad is-boost"
              type="button"
              aria-label="Boost"
              onPointerDown={() => engine.current?.setMoveInput({ boost: true })}
              onPointerUp={() => engine.current?.setMoveInput({ boost: false })}
              onPointerLeave={() => engine.current?.setMoveInput({ boost: false })}
            >
              ⚡
            </button>
          </div>
        </div>
      )}

      <div className="atlas-hud atlas-help">
        <p>
          {touch ? (
            <>Drag to look · pinch to zoom · tap a node to inspect</>
          ) : (
            <>
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · <kbd>Q</kbd><kbd>E</kbd> down/up · <kbd>Shift</kbd> boost ·
              drag to look · click a node to inspect · <kbd>F</kbd> fly to it · <kbd>Z</kbd><kbd>C</kbd> turn
            </>
          )}
        </p>
        {near && <p className="near">Near: {near}</p>}
        {status && <p className="atlas-status">{status}</p>}
        {failed && <p className="error">{failed}</p>}
      </div>

      {selected && (
        <aside className="atlas-hud atlas-detail" aria-live="polite">
          <div className="atlas-detail-head">
            <span className="swatch" style={{ background: kindColour[selected.kind] }} />
            <p className="eyebrow">{selected.kind}</p>
            <button className="btn ghost" type="button" onClick={closeDetail} aria-label="Close details">
              ×
            </button>
          </div>
          <h2>{selected.label}</h2>
          <p>{selected.detail}</p>
          {selected.bullets.length > 0 && (
            <ul>
              {selected.bullets.slice(0, 9).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
          <div className="atlas-detail-actions">
            <button className="btn" type="button" onClick={() => flyTo(selected.id)}>
              Fly to it
            </button>
            {selected.kind === "site" && (
              <>
                <button className="btn" type="button" onClick={() => engine.current?.loadSite(selected.id)}>
                  Load in the space
                </button>
                <button className="btn" type="button" onClick={() => openScan(selected)}>
                  Scan it
                </button>
              </>
            )}
            <button className="btn ghost" type="button" onClick={() => void copyLink(selected)}>
              {copied ? "Copied" : "Copy link"}
            </button>
            {selected.href && (
              <a className="btn ghost" href={selected.href} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            )}
          </div>
        </aside>
      )}

      {panel === "projects" && (
        <section className="atlas-hud atlas-panel-sheet" aria-label="Add a project">
          <div className="atlas-sheet-head">
            <h2>Add a project</h2>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>
          <p className="atlas-sheet-note">
            These live in <strong>this browser</strong>, not in the repository — so they appear here and nowhere else, and
            nobody else sees them. The three built-in projects stay where they are.
          </p>
          <div className="atlas-form">
            <label>
              Name
              <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Hilltop Cafe" maxLength={80} />
            </label>
            <label>
              What it is
              <input value={draft.line} onChange={(event) => setDraft({ ...draft, line: event.target.value })} placeholder="Menus, table bookings, a deposit taken at the door" maxLength={200} />
            </label>
            <label>
              Link (optional)
              <input value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} placeholder="https://hilltop.example" inputMode="url" />
            </label>
            <label>
              Stack (optional, comma separated)
              <input value={draft.stack} onChange={(event) => setDraft({ ...draft, stack: event.target.value })} placeholder="Astro, Stripe, Cloudflare" />
            </label>
            <button className="btn" type="button" onClick={addProject}>
              Put it in the space
            </button>
          </div>
          {ownProjects.length > 0 && (
            <ul className="atlas-own">
              {ownProjects.map((project) => (
                <li key={project.id}>
                  <button type="button" className="atlas-own-go" onClick={() => jump(atlas.nodes.find((node) => node.id === project.id) ?? atlas.nodes[0]!)}>
                    {project.label}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => removeProject(project.id)} aria-label={`Remove ${project.label}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {panel === "audit" && (
        <section className="atlas-hud atlas-panel-sheet atlas-audit" aria-label="Audit">
          <div className="atlas-sheet-head">
            <h2>Audit</h2>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>

          <div className="atlas-audit-block">
            <p className="atlas-sheet-note">
              <strong>The space.</strong> Mechanical checks over the same data the scene is built from: missing sources,
              dangling links, thin nodes, duplicate names, unreachable positions, and — on a machine with the repository —
              whether each post's proof file exists.
            </p>
            <p className="atlas-audit-tally">
              {findings === null
                ? "Not run."
                : findings.length === 0
                  ? "Nothing found."
                  : `${findings.filter((finding) => finding.severity === "high").length} high · ${findings.filter((finding) => finding.severity === "medium").length} medium · ${findings.filter((finding) => finding.severity === "low").length} low`}
            </p>
            {findings && findings.length > 0 && (
              <ul className="atlas-findings">
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (finding.node) {
                          const node = atlas.nodes.find((entry) => entry.id === finding.node);
                          if (node) jump(node);
                        }
                      }}
                    >
                      <span className={`severity is-${finding.severity}`}>{finding.severity}</span>
                      <strong>{finding.title}</strong>
                      <small>{finding.detail}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="atlas-audit-block">
            <p className="atlas-sheet-note">
              <strong>A page.</strong> Reads one public URL through <code>/api/site</code> and reports what it says about
              itself — title, description, one clear headline, structured data, alt text, viewport, canonical, share card
              and readable words. Nothing is crawled and nothing is stored.
            </p>
            <div className="atlas-scan-bar">
              <input
                value={siteUrl}
                onChange={(event) => setSiteUrl(event.target.value)}
                placeholder="https://example.co.uk"
                aria-label="URL to audit"
                inputMode="url"
              />
              <button className="btn" type="button" onClick={() => void runSiteAudit()} disabled={siteBusy}>
                {siteBusy ? "Reading…" : "Audit it"}
              </button>
            </div>
            {siteError && <p className="atlas-error">{siteError}</p>}
            {siteReport && (
              <div className="atlas-report">
                <p className="atlas-report-head">
                  <strong>{siteReport.title || "(no title)"}</strong> — {siteReport.words} words
                </p>
                <p className="atlas-sheet-note">{siteReport.description || "No meta description."}</p>
                <ul className="atlas-checks">
                  {siteReport.checks.map((check) => (
                    <li key={check.id} className={`is-${check.status}`}>
                      <span>{check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✕"}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                        {check.status !== "pass" && <small className="atlas-because">{check.because}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="atlas-sheet-note">{siteReport.verdict}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {panel === "scan" && scanSite && (
        <section className="atlas-hud atlas-scan" aria-label={`Scanning ${scanSite.label}`}>
          <div className="atlas-sheet-head">
            <span className="swatch" style={{ background: kindColour[scanSite.kind] }} />
            <h2>{scanSite.label}</h2>
            <a className="btn ghost" href={scanSite.href} target="_blank" rel="noopener noreferrer">
              Open in a tab
            </a>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>
          <p className="atlas-sheet-note">
            Scroll the page here, the way a visitor would. Sites that send <code>X-Frame-Options</code> or a
            <code> frame-ancestors</code> rule stay blank — that is the site refusing to be framed, not a broken reader,
            and the tab link is the way in.
          </p>
          {scanSite.href ? (
            <iframe className="atlas-scan-frame" src={scanSite.href} title={scanSite.label} loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <p className="atlas-error">This site has no address recorded.</p>
          )}
          <div className="atlas-scan-actions">
            <button className="btn" type="button" onClick={() => void runSiteAudit()}>
              Audit this page
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setSiteUrl(scanSite.href ?? "");
                setPanel("audit");
                setStatus("Run “Audit it” to check that page.");
              }}
            >
              Open the audit panel
            </button>
          </div>
        </section>
      )}

      {!ready && !failed && <div className="atlas-hud atlas-loading">Building the space…</div>}
    </div>
  );
}

/** A thumbstick that reports the vector it is being pushed towards. */
function Thumbstick({ onChange }: { onChange: (vector: { forward: number; strafe: number }) => void }) {
  const pad = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const update = (clientX: number, clientY: number) => {
    const box = pad.current?.getBoundingClientRect();
    if (!box) return;
    const radius = box.width / 2;
    let x = (clientX - (box.left + radius)) / radius;
    let y = (clientY - (box.top + radius)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setKnob({ x: x * radius * 0.62, y: y * radius * 0.62 });
    onChange({ forward: -y, strafe: x });
  };

  const release = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onChange({ forward: 0, strafe: 0 });
  };

  return (
    <div
      ref={pad}
      className="atlas-thumb"
      role="group"
      aria-label="Move — drag the stick"
      onPointerDown={(event) => {
        active.current = true;
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (active.current) update(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="atlas-thumb-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** The same space as a keyboard-and-screen-reader friendly list. */
export function AtlasList({ onPick }: { onPick?: (node: AtlasNode) => void }) {
  const atlas = useMemo(() => buildAtlas(), []);
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const visible = atlas.nodes.filter((node) => kind === "all" || node.kind === kind);
  return (
    <div className="atlas-list">
      <div className="atlas-filters" role="group" aria-label="Show only">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${kind === entry.id ? " is-on" : ""}`}
            aria-pressed={kind === entry.id}
            onClick={() => setKind(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <ul>
        {visible.map((node) => (
          <li key={node.id}>
            <span className="swatch" style={{ background: kindColour[node.kind] }} />
            <div>
              <button type="button" onClick={() => onPick?.(node)}>
                {node.label}
              </button>
              <p>{node.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
