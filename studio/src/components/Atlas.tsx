import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtlasEngine } from "../atlasEngine";
import { buildAtlas, distance, kindColour, searchAtlas, type AtlasNode, type District, type NodeKind } from "../atlas";

const KIND_DISTRICT: Record<NodeKind, "library" | "projects" | "builder" | "packs" | "content" | "gallery"> = {
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

/**
 * The Atlas — one space holding the projects, the process library, the packs
 * that install them, the blog plan for sitebuildup.co.uk, and live site panels.
 *
 * It is deliberately usable without a GitHub token: the structure is local data,
 * so a client can be given a link to the space before anyone has signed in.
 */
export function Atlas({ onClose }: { onClose?: () => void }) {
  const atlas = useMemo(() => buildAtlas(), []);
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

  const results = useMemo(() => (query.trim() ? searchAtlas(atlas, query, 8) : []), [atlas, query]);

  useEffect(() => {
    if (!host.current || !cssHost.current || !stage.current) return;
    let instance: AtlasEngine | null = null;
    try {
      instance = new AtlasEngine(host.current, cssHost.current, stage.current, atlas, {
        onSelect: (node) => setSelected(node),
        onTick: (info) => {
          setPosition(info.position);
          setDistrict(info.district);
          setNear(info.near);
          setHeading(info.heading);
        },
        onStatus: (message) => setStatus(message),
      });
      engine.current = instance;
      setReady(true);
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
      instance?.dispose();
      engine.current = null;
    };
  }, [atlas]);

  useEffect(() => {
    engine.current?.setFilter(filter);
  }, [filter]);

  const flyTo = useCallback((id: string) => {
    engine.current?.flyToId(id);
  }, []);

  const jump = (node: AtlasNode) => {
    flyTo(node.id);
    setSelected(node);
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

  const districtInfo = atlas.districts.find((entry) => entry.id === district);
  const counts = atlas.nodes.reduce<Record<string, number>>((totals, node) => {
    totals[node.kind] = (totals[node.kind] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <div className="atlas">
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
          />
          <button className="btn" type="submit">Fly to</button>
        </form>

        <div className="atlas-actions">
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
              const district = entry.id === "all" ? null : KIND_DISTRICT[entry.id];
              if (district) {
                const centre = atlas.districts.find((place) => place.id === district)?.centre;
                if (centre) engine.current?.focusDistrict(centre, entry.id === "brief" ? 34 : 58);
              }
            }}
          >
            {entry.label}
            <span>{entry.id === "all" ? atlas.nodes.length : counts[entry.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {query.trim() && (
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

      <div className="atlas-hud atlas-map" aria-hidden="true">
        <svg viewBox="-240 -240 480 480" role="presentation">
          <circle cx="0" cy="0" r="230" className="ring" />
          {atlas.districts.map((entry) => (
            <g key={entry.id}>
              <circle cx={entry.centre[0]} cy={entry.centre[2]} r="10" className="district" />
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

      <div className="atlas-hud atlas-help">
        <p>
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · <kbd>Q</kbd><kbd>E</kbd> down/up · <kbd>Shift</kbd> boost ·
          drag to look · click a node to inspect · <kbd>F</kbd> fly to it · <kbd>Z</kbd><kbd>C</kbd> turn
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
            <button className="btn ghost" type="button" onClick={() => setSelected(null)} aria-label="Close details">
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
              <button className="btn" type="button" onClick={() => engine.current?.loadSite(selected.id)}>
                Load the live page
              </button>
            )}
            {selected.href && (
              <a className="btn ghost" href={selected.href} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            )}
          </div>
        </aside>
      )}

      {!ready && !failed && <div className="atlas-hud atlas-loading">Building the space…</div>}
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
