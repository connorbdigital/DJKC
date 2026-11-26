import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AtlasNode } from "../atlas";
import { buildSpace, inbound, mergeLive, type Space } from "../atlasSpace";
import { SiteThumb } from "./SiteThumb";

/**
 * A project's own space. The City is the district; this is the room inside it.
 *
 * Everything the project record knows is here — every page, the front page in
 * the middle — and the streams are read off the pages themselves when the space
 * opens. A page that refuses to be read keeps its place on the ring and says so.
 */

interface ProjectSpaceProps {
  project: AtlasNode;
  onClose: () => void;
}

interface Reading {
  id: string;
  state: "reading" | "read" | "failed";
  detail?: string;
}

const MAX_AUTO = 4;

export default function ProjectSpace({ project, onClose }: ProjectSpaceProps) {
  /* A project has pages. An anything.com app has modules — parts, not pages —
     so they stand on the same ring without an address to open. */
  const parts = useMemo(
    () => project.pages ?? (project.modules ?? []).map((label) => ({ label, href: "" })),
    [project.pages, project.modules]
  );
  const seed = useMemo(
    () => buildSpace(project.label, project.href ?? "", parts),
    [project.label, project.href, parts]
  );
  const [space, setSpace] = useState<Space>(seed);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [active, setActive] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  /* Focus moves into the room when it opens, so Escape and Tab stay inside it. */
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  const exists = useCallback((node: { href: string }) => Boolean(node.href), []);

  const read = useCallback(
    async (id: string) => {
      const target = [space.hub, ...space.nodes].find((node) => node.id === id);
      if (!target || !exists(target)) return;
      if (readings[id]?.state === "reading") return;
      setReadings((current) => ({ ...current, [id]: { id, state: "reading" } }));
      let body: { ok?: boolean; links?: { label: string; href: string }[]; error?: string } = {};
      let status = 0;
      try {
        const response = await fetch("/api/site", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: target.href, links: true }),
        });
        status = response.status;
        const text = await response.text();
        try {
          body = JSON.parse(text) as typeof body;
        } catch {
          body = {};
          status = status === 200 ? 0 : status;
        }
      } catch {
        body = {};
      }
      if (!body.ok || !Array.isArray(body.links)) {
        const why =
          body.error ??
          (status
            ? `the page map answered ${status}`
            : "no answer — the page map runs on the deployed Studio, not the local preview");
        setReadings((current) => ({ ...current, [id]: { id, state: "failed", detail: why } }));
        return;
      }
      setSpace((current) => mergeLive(current, id, body.links!));
      setReadings((current) => ({
        ...current,
        [id]: { id, state: "read", detail: body.links!.length ? undefined : "no links on this page yet" },
      }));
    },
    [exists, readings, space.hub, space.nodes]
  );

  /* Read the front page and the first few pages as soon as the space opens, so
     the web is already there rather than something to ask for. */
  useEffect(() => {
    const queue = [seed.hub, ...seed.nodes].filter((node) => node.href).slice(0, MAX_AUTO);
    let cancelled = false;
    const run = async () => {
      for (const node of queue) {
        if (cancelled) return;
        await read(node.id);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    /* Only when the project changes: reading again on every state change would
       never stop. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    /* Capture, so the City's own key handler cannot swallow the key first. */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        /* The City's engine would also take Escape and clear the selection
           behind us; the project should still be selected when the room closes. */
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const ranking = useMemo(() => new Map(inbound(space).map((row) => [row.id, row.count])), [space]);
  /* Streams read off the pages, as opposed to the ones the record implies. */
  const readIn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of space.edges) {
      if (edge.source !== "live") continue;
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [space]);
  const readCount = Object.values(readings).filter((row) => row.state === "read").length;
  const liveEdges = space.edges.filter((edge) => edge.source === "live").length;
  const all = [space.hub, ...space.nodes];
  const byId = new Map(all.map((node) => [node.id, node]));
  const selected = active ? byId.get(active) : undefined;
  const unread = all.filter((node) => node.href && readings[node.id]?.state !== "read");

  return (
    <div
      className="space"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.label}: its own space`}
      ref={dialog}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="space-head">
        <div>
          <p className="space-kicker">Inside the project</p>
          <h2>{project.label}</h2>
          <p className="space-meta">
            {all.length} {all.length === 1 ? "page" : "pages"} · {readCount} read · {liveEdges}{" "}
            {liveEdges === 1 ? "link read" : "links read"}
          </p>
        </div>
        <div className="space-head-actions">
          {project.href && (
            <a className="space-button" href={project.href} target="_blank" rel="noopener noreferrer">
              Open the site ↗
            </a>
          )}
          <button type="button" className="space-button quiet" onClick={onClose}>
            Back to the City
          </button>
        </div>
      </header>

      <div className="space-body">
        <figure className="space-map">
          <svg viewBox="-1.02 -1.02 2.04 2.04" role="img" aria-label={`Pages of ${project.label} and the links between them`}>
            {space.edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              const touched = active === edge.from || active === edge.to;
              return (
                <line
                  key={`${edge.from}->${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`space-edge ${edge.source}${touched ? " touched" : ""}`}
                />
              );
            })}
            {all.map((node) => {
              const reading = readings[node.id];
              const classes = [
                "space-node",
                node.kind,
                reading?.state === "read" ? "read" : "",
                reading?.state === "failed" ? "failed" : "",
                reading?.state === "reading" ? "reading" : "",
                active === node.id ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <g
                  key={node.id}
                  className={classes}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => setActive(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActive(node.id);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.label}${reading?.state === "read" ? ", read" : ""}`}
                >
                  <circle r={node.r} />
                  {node.kind === "page" && readIn.get(node.id) ? (
                    <text className="space-count" y={-node.r - 0.03}>
                      {readIn.get(node.id)}
                    </text>
                  ) : null}
                  <text className={node.kind === "hub" ? "space-label hub" : "space-label"} y={node.r + 0.075}>
                    {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="muted small">
            Solid lines were read off the pages. Faint ones are pages the project record already
            held. A dotted ring means that page has not been read yet — no streams guessed.
          </figcaption>
        </figure>

        <div className="space-side">
          {selected ? (
            <div className="space-card">
              <h3>{selected.label}</h3>
              <p className="muted small">{selected.href || "No address recorded for this one."}</p>
              {readings[selected.id]?.state === "failed" && (
                <p className="space-warn">Could not read it: {readings[selected.id]!.detail}</p>
              )}
              {selected.href && selected.kind !== "hub" && <SiteThumb url={selected.href} label={selected.label} />}
              <div className="space-actions">
                {selected.href && (
                  <a className="space-button" href={selected.href} target="_blank" rel="noopener noreferrer">
                    Open the page ↗
                  </a>
                )}
                <button
                  type="button"
                  className="space-button quiet"
                  onClick={() => void read(selected.id)}
                  disabled={!selected.href || readings[selected.id]?.state === "reading"}
                >
                  {readings[selected.id]?.state === "read" ? "Read it again" : "Read its links"}
                </button>
              </div>
              <p className="muted small">
                {(() => {
                  const live = readIn.get(selected.id) ?? 0;
                  const all = ranking.get(selected.id) ?? 0;
                  if (!all) return "Nothing in this project points here.";
                  if (!live) return `${all} stream${all === 1 ? "" : "s"} on the record, none read off a page yet.`;
                  return `${live} read off the pages, ${all} in all.`;
                })()}
              </p>
            </div>
          ) : (
            <div className="space-card">
              <h3>Pick a star</h3>
              <p className="muted small">
                A circle is a page. A line is a link. Tap one to open it or read its links.
              </p>
              {unread.length > 0 && (
                <button
                  type="button"
                  className="space-button quiet"
                  onClick={() => {
                    setNote(`Reading ${unread.length} more…`);
                    void (async () => {
                      for (const node of unread) await read(node.id);
                      setNote(null);
                    })();
                  }}
                >
                  Read the {unread.length} unread {unread.length === 1 ? "page" : "pages"}
                </button>
              )}
            </div>
          )}

          <div className="space-list">
            <h3>Every page</h3>
            <ul>
              {all.map((node) => {
                const reading = readings[node.id];
                return (
                  <li key={node.id} className={node.kind === "hub" ? "hub" : ""}>
                    <button type="button" className="space-row" onClick={() => setActive(node.id)}>
                      <span className="space-row-name">
                        {node.label}
                        {node.kind === "hub" && <em> front page</em>}
                      </span>
                      <span className="space-row-tag">
                        {readIn.get(node.id)
                          ? `${readIn.get(node.id)} read in`
                          : ranking.get(node.id)
                            ? "only from the record"
                            : "nothing points here"}
                        {reading?.state === "read" && " · read"}
                        {reading?.state === "failed" && " · refused"}
                        {reading?.state === "reading" && " · reading"}
                      </span>
                    </button>
                    {node.href && (
                      <a href={node.href} target="_blank" rel="noopener noreferrer" className="space-row-open">
                        open ↗
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            {space.nodes.length === 0 && (
              <p className="muted small">
                No pages recorded for this project yet — the front page is the only one we hold.
              </p>
            )}
          </div>
          {note && <p className="muted small">{note}</p>}
        </div>
      </div>
      <p className="space-foot muted small">
        These are the pages the project record holds, plus every link read off them. Anything behind a
        form, a login or a script stays out of reach.
      </p>
    </div>
  );
}
