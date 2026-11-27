import { useCallback, useEffect, useMemo, useState } from "react";
import { CAPABILITIES } from "../features";
import { PROJECTS, STUDIO_COMPONENTS } from "../atlas";
import { loadAnythingApps } from "../anythingClient";
import { auditSite, buildUniversal, sourceFromPages, type AuditResult, type Source } from "../universal";

/**
 * What every site should have — worked out from the sites the Studio has read,
 * not from a list of best practice somebody wrote on a blog in 2019.
 *
 * Two halves, and they are deliberately in that order: the checklist is evidence
 * (this function turns up in four of the five places the Studio knows about), and
 * the audit is a reading of one site against it (sitebuildup has prices and
 * questions; it has no page that says where it will and will not travel).
 *
 * What is not in it, said on the page rather than left to be discovered: the
 * Studio's GitHub reading and the Anything account only exist behind a key and a
 * deployment, so the sources here are the ones this page can reach without either.
 */

const AUDIT_DEFAULT = "https://kaysie.sitebuildup.co.uk/";

interface Reading {
  label: string;
  href: string;
}

export default function Universal() {
  const [apps, setApps] = useState<{ label: string; parts: string[] }[]>([]);
  const [appsNote, setAppsNote] = useState<string>("Reading the Anything account…");
  const [target, setTarget] = useState(AUDIT_DEFAULT);
  const [reading, setReading] = useState(false);
  const [pages, setPages] = useState<Reading[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadAnythingApps({ limit: 8 })
      .then((load) => {
        if (!live) return;
        if (!load.ok) {
          setAppsNote(`${load.reason} — so the Anything account is not in the evidence below.`);
          return;
        }
        const list = load.apps.map((app) => ({ label: app.name, parts: app.modules }));
        setApps(list);
        setAppsNote(
          list.length
            ? `${list.length} ${list.length === 1 ? "app" : "apps"} read through this deployment's key`
            : "The Anything account answered with no apps, so it is not in the evidence below."
        );
      })
      .catch(() => {
        if (live) setAppsNote("The Anything account could not be read from here — it is not in the evidence below.");
      });
    return () => {
      live = false;
    };
  }, []);

  const sources: Source[] = useMemo(() => {
    const list: Source[] = PROJECTS.map((project) =>
      sourceFromPages(
        project.id,
        project.label,
        "site",
        project.pages.map((page) => ({ label: page.label, href: page.href }))
      )
    );
    for (const app of apps) {
      list.push(sourceFromPages(`app-${app.label}`, app.label, "app", app.parts.map((part) => ({ label: part }))));
    }
    list.push(
      sourceFromPages(
        "studio",
        "The Studio's own parts",
        "studio",
        STUDIO_COMPONENTS.map((part) => ({ label: part.label }))
      )
    );
    list.push(
      sourceFromPages(
        "processes",
        "The thirteen processes",
        "process",
        CAPABILITIES.map((entry) => ({ label: entry.name, href: `/process/${entry.id}.html` }))
      )
    );
    return list;
  }, [apps]);

  const universal = useMemo(() => buildUniversal(sources), [sources]);

  const runAudit = useCallback(async () => {
    const url = target.trim();
    if (!url) return;
    setReading(true);
    setProblem(null);
    setPages(null);
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, links: true }),
      });
      const body = (await response.json()) as { ok?: boolean; links?: Reading[]; error?: string };
      if (!body.ok || !Array.isArray(body.links)) {
        setProblem(body.error ?? "That page would not answer, so there is nothing to audit.");
        return;
      }
      /* The page itself counts: its own address is the front door if nothing else is. */
      const seen = new Set<string>();
      const all: Reading[] = [];
      for (const entry of [{ label: "The page you gave me", href: url }, ...body.links]) {
        if (seen.has(entry.href)) continue;
        seen.add(entry.href);
        all.push(entry);
      }
      setPages(all);
    } catch {
      setProblem("That page could not be read from here.");
    } finally {
      setReading(false);
    }
  }, [target]);

  const audit: AuditResult | null = useMemo(
    () => (pages ? auditSite(pages, universal) : null),
    [pages, universal]
  );

  return (
    <div className="universal">
      <section className="panel" aria-label="What every site should have">
        <div className="panel-head">
          <div>
            <p className="eyebrow">The universal set</p>
            <h2>What every site should have</h2>
            <p className="muted">
              Every function that turns up more than once across the {universal.sources.length} places the Studio has
              read — {universal.sources.reduce((total, source) => total + source.pages, 0)} pages and parts between
              them. One page called “Prices” is a page; four is a function. Nothing here is on the list because a
              checklist said so.
            </p>
          </div>
        </div>
        {universal.entries.length === 0 && <p className="muted">Nothing shared has been read yet.</p>}
        <ol className="universal-list">
          {universal.entries.map((entry) => (
            <li key={entry.id} className={`universal-row${entry.everywhere ? " is-everywhere" : ""}`}>
              <div className="universal-main">
                <h3>
                  {entry.label}
                  {entry.everywhere && <span className="badge">everywhere</span>}
                </h3>
                <p className="muted small">{entry.why}</p>
                <p className="muted small">
                  {entry.coverage} {entry.coverage === 1 ? "page or part" : "pages and parts"} across{" "}
                  {entry.sourceCount} of {universal.sources.filter((source) => source.pages > 0).length}:{" "}
                  {entry.have.join(" · ")}
                  {entry.lack.length > 0 ? ` — not in ${entry.lack.join(" · ")}` : ""}
                </p>
              </div>
              <div className="universal-bar" aria-hidden="true">
                <span style={{ width: `${(entry.coverage / Math.max(universal.entries[0]?.coverage ?? 1, 1)) * 100}%` }} />
              </div>
              {entry.example && entry.example.href ? (
                <a className="universal-example" href={entry.example.href} target="_blank" rel="noreferrer">
                  {entry.example.label} ↗
                </a>
              ) : (
                <span className="universal-example muted small">{entry.example?.label ?? "—"}</span>
              )}
            </li>
          ))}
        </ol>
        <p className="muted small universal-where">
          Evidence: {universal.sources.map((source) => `${source.label} (${source.pages})`).join(" · ")}. {appsNote} The
          GitHub repositories and the Vercel projects are not in this list: the Studio reads repos only with a key and
          has no Vercel API at all, and a checklist built from what it cannot see is a guess wearing a table.
        </p>
      </section>

      <section className="panel" aria-label="Audit a site against it">
        <div className="panel-head">
          <div>
            <p className="eyebrow">The audit</p>
            <h2>One site, against the universal set</h2>
            <p className="muted">
              Read the site's front page and every link on it, put each page in a function, and say what is there and
              what is not. A page that would not be read is an unknown, not a fault.
            </p>
          </div>
        </div>
        <div className="universal-audit-form">
          <input
            className="input"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            aria-label="The site to audit"
            placeholder="https://example.com/"
          />
          <button className="btn" type="button" onClick={() => void runAudit()} disabled={reading}>
            {reading ? "Reading…" : "Audit it"}
          </button>
        </div>
        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        {audit && (
          <div className="universal-audit">
            <p className="muted small">
              Read {pages?.length ?? 0} page{pages?.length === 1 ? "" : "s"}: {audit.present.length} of{" "}
              {universal.entries.length} functions present
              {audit.unclassified.length > 0 ? ` · ${audit.unclassified.length} page(s) I could not place` : ""}.
            </p>
            {audit.thin && (
              <p className="warn small">
                One page is not an audit. This site answered with too few links to say what it has.
              </p>
            )}
            <h3>It has</h3>
            {audit.present.length === 0 && <p className="muted small">Nothing from the universal set.</p>}
            <ul className="universal-found">
              {audit.present.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.label}</span>
                  <a href={entry.page.href} target="_blank" rel="noreferrer">
                    {entry.page.label || entry.page.href.replace(/^https?:\/\//, "")} ↗
                  </a>
                </li>
              ))}
            </ul>
            <h3>It does not have</h3>
            {audit.missing.length === 0 && <p className="muted small">It has everything on the list. That is rare.</p>}
            <ul className="universal-missing">
              {audit.missing.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.label}</span>
                  <span className="muted small">{entry.why}</span>
                </li>
              ))}
            </ul>
            {audit.unclassified.length > 0 && (
              <>
                <h3>I could not place</h3>
                <ul className="universal-found">
                  {audit.unclassified.map((page) => (
                    <li key={page.href}>
                      <span className="muted">{page.label || "a link with no name"}</span>
                      <a href={page.href} target="_blank" rel="noreferrer">
                        {page.href.replace(/^https?:\/\//, "")} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted small">
              This is an audit of a front page and the links on it, not a crawl: a page nobody links to is a page this
              cannot see.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
