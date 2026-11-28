import { useEffect, useMemo, useRef, useState } from "react";
import { checkUrl, type SiteReport } from "../sitecheck";
import { OFFERS, buildPitch, emailDraft, mailtoFor, nextToPitch, toProspect, type Prospect, type ProspectStatus } from "../pitch";
import { exportProspects, importProspects, loadProspects, removeProspect, saveProspect, setProspectStatus } from "../pitchStore";

/**
 * The pitch sheet, as a tool rather than a page.
 *
 * A URL in, one printable page out — and now: a list that survives the tab, a
 * drafted email, a mail link, and a hash anybody can reopen. The reading of the
 * site happens on the deployment (`/api/site`), because a browser cannot fetch
 * another origin's HTML.
 */

const MAX_BATCH = 5;

const splitTargets = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH);

const STATUS_LABEL: Record<ProspectStatus, string> = { new: "Not written to", sent: "Sent", won: "Won", lost: "Lost" };

export function Pitch() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Prospect | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>(() => loadProspects());
  const [copied, setCopied] = useState<"text" | "email" | "link" | "">("");
  const [backup, setBackup] = useState("");
  const restoreInput = useRef<HTMLInputElement | null>(null);

  const next = useMemo(() => nextToPitch(prospects), [prospects]);

  /* A sheet is a link: `#tab=pitch&u=https://…` opens the tab and reads the site. */
  useEffect(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    const carried = /(?:^|[#&])u=([^&]+)/.exec(hash)?.[1];
    if (!carried) {
      /* Coming back to the tab reopens the last sheet rather than an empty page. */
      const latest = loadProspects()[0];
      if (latest) setSheet(latest);
      return;
    }
    setInput(decodeURIComponent(carried));
    /* Only once, and only when the tab was opened with a site in the link. */
    const timer = setTimeout(() => void run([decodeURIComponent(carried)]), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const audit = async (target: string): Promise<SiteReport> => {
    const verdict = checkUrl(target);
    if (!verdict.ok || !verdict.url) throw new Error(verdict.reason ?? "That URL cannot be checked.");
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
    return data.report;
  };

  const run = async (targets: string[]) => {
    setError("");
    setCopied("");
    const list = targets.length ? targets : splitTargets(input);
    if (!list.length) {
      setError("Enter a URL first.");
      return;
    }
    let last: Prospect | null = null;
    let kept = prospects;
    for (const [index, target] of list.entries()) {
      setBusy(list.length > 1 ? `Reading ${index + 1} of ${list.length}…` : "Reading the page…");
      try {
        const verdict = checkUrl(target);
        const report = await audit(target);
        const pitch = buildPitch(report, verdict.ok && verdict.url ? verdict.url.toString() : target);
        last = toProspect(pitch);
        kept = saveProspect(last);
      } catch (problem) {
        const message = problem instanceof Error ? problem.message : "The page could not be audited.";
        setError(
          /404|405|unexpected token|failed to fetch|not found/i.test(message)
            ? "The audit runs on the deployed Studio (/api/site), not on a dev server. Open the deployed URL, or try a site that allows being read."
            : message
        );
        if (list.length === 1) break;
      }
    }
    setProspects(kept);
    if (last) setSheet(last);
    setBusy("");
  };

  const copy = async (kind: "text" | "email" | "link") => {
    if (!sheet) return;
    try {
      if (kind === "text") {
        const { body } = emailDraft(sheet.sheet);
        await navigator.clipboard.writeText(body);
      }
      if (kind === "email") {
        const { subject, body } = emailDraft(sheet.sheet);
        await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      }
      if (kind === "link") {
        const link = `${location.origin}${location.pathname}#tab=pitch&u=${encodeURIComponent(sheet.url)}`;
        await navigator.clipboard.writeText(link);
      }
      setCopied(kind);
    } catch {
      setError("The clipboard refused. Select the sheet and copy it by hand.");
    }
  };

  const mark = (status: ProspectStatus) => {
    if (!sheet) return;
    setProspects(setProspectStatus(sheet.id, status));
    setSheet({ ...sheet, status });
  };

  const open = (prospect: Prospect) => {
    setSheet(prospect);
    setInput(prospect.url);
    setCopied("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pitch">
      <form
        className="pitch-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run([]);
        }}
      >
        <label htmlFor="pitch-url">A prospect's URL — up to five at once, one per line</label>
        <input
          id="pitch-url"
          type="text"
          inputMode="url"
          placeholder="https://example.co.uk"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          spellCheck={false}
        />
        <button className="btn primary" type="submit" disabled={Boolean(busy)}>
          {busy || "Build the sheet"}
        </button>
      </form>
      <p className="muted small pitch-intro">
        The sheet says what is wrong, what each fault costs, what to do first, and which of the four packages fits. It is
        saved in this browser, so the list below survives the tab; the link carries the site, not the sheet, so it always
        shows today's reading. Print it, copy the email, or paste the link.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      {prospects.length > 0 && (
        <section className="prospects">
          <h2>Prospects · {prospects.length}</h2>
          {next && (
            <p className="muted small">
              {next.status === "sent" ? (
                <>
                  Nothing unsent left. Follow up with <strong>{next.host}</strong> — the sheet was built {next.date}.
                </>
              ) : (
                <>
                  Write to <strong>{next.host}</strong> first — {next.findings} fault{next.findings === 1 ? "" : "s"},{" "}
                  {next.offer} {next.price}.
                </>
              )}
            </p>
          )}
          <ul className="prospect-list">
            {prospects.map((prospect) => (
              <li key={prospect.id} data-status={prospect.status}>
                <button className="prospect-open" type="button" onClick={() => open(prospect)}>
                  <span className="prospect-host">{prospect.host}</span>
                  <span className="prospect-meta">
                    {prospect.findings} fault{prospect.findings === 1 ? "" : "s"} · {prospect.score}% · {prospect.price} ·{" "}
                    {prospect.date}
                  </span>
                  <span className={`prospect-status is-${prospect.status}`}>{STATUS_LABEL[prospect.status]}</span>
                </button>
                <button
                  className="btn ghost small"
                  type="button"
                  aria-label={`Forget ${prospect.host}`}
                  onClick={() => {
                    const kept = removeProspect(prospect.id);
                    setProspects(kept);
                    if (sheet?.id === prospect.id) setSheet(null);
                  }}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
          {/*
            The list lives in this browser and nowhere else: clearing the cache takes
            it, and a second device starts from nothing. A file is the smallest honest
            fix — it survives the browser, it can be mailed to yourself, and it does
            not pretend to be a database.
          */}
          <div className="pitch-actions prospect-backup">
            <button
              className="btn ghost small"
              type="button"
              onClick={() => {
                const name = `studio-pitch-${new Date().toISOString().slice(0, 10)}.json`;
                const url = URL.createObjectURL(new Blob([exportProspects(prospects)], { type: "application/json" }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = name;
                anchor.click();
                URL.revokeObjectURL(url);
                setBackup(`Saved ${prospects.length} prospect${prospects.length === 1 ? "" : "s"} as ${name}.`);
              }}
            >
              Back up the list
            </button>
            <button className="btn ghost small" type="button" onClick={() => restoreInput.current?.click()}>
              Restore a backup
            </button>
            <input
              ref={restoreInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const result = importProspects(await file.text());
                if (!result.ok) {
                  setBackup(result.reason);
                  return;
                }
                setProspects(result.prospects);
                setBackup(
                  `Restored: ${result.added} added, ${result.updated} already known. ${result.prospects.length} in the list.`
                );
              }}
            />
            {backup && <span className="muted small" role="status">{backup}</span>}
          </div>
        </section>
      )}

      {sheet && (
        <>
          <div className="pitch-actions">
            <button className="btn" type="button" onClick={() => window.print()}>
              Print / save as PDF
            </button>
            <button className="btn ghost" type="button" onClick={() => void copy("email")}>
              {copied === "email" ? "Email copied" : "Copy the email"}
            </button>
            <a className="btn ghost" href={mailtoFor(sheet.sheet)}>
              Open in mail
            </a>
            <button className="btn ghost" type="button" onClick={() => void copy("link")}>
              {copied === "link" ? "Link copied" : "Copy link"}
            </button>
            <button className="btn ghost" type="button" onClick={() => void copy("text")}>
              {copied === "text" ? "Body copied" : "Copy body only"}
            </button>
          </div>
          <div className="pitch-actions">
            <span className="muted small">Mark as:</span>
            {(["new", "sent", "won", "lost"] as ProspectStatus[]).map((status) => (
              <button
                key={status}
                className={sheet.status === status ? "btn small" : "btn ghost small"}
                type="button"
                onClick={() => mark(status)}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
          </div>

          <article className="pitch-sheet">
            <header>
              <p className="eyebrow">SiteBuildup · site check</p>
              <h1>{sheet.sheet.headline}</h1>
              <p className="pitch-meta">
                {sheet.host} · {sheet.sheet.passes} of {sheet.sheet.passes + sheet.sheet.findings.length} checks passing ·
                score {sheet.sheet.score}%
              </p>
            </header>

            {sheet.sheet.findings.length ? (
              <section>
                <h2>What is wrong, worst first</h2>
                <ol>
                  {sheet.sheet.findings.map((finding) => (
                    <li key={finding.id}>
                      <strong>{finding.label}</strong>
                      {" — "}
                      {finding.detail}. <em>{finding.cost.charAt(0).toUpperCase() + finding.cost.slice(1)}.</em>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <section>
                <h2>Nothing is failing</h2>
                <p>The mechanics are in place. The remaining work is being found: search, proof and a route to enquire.</p>
              </section>
            )}

            <section>
              <h2>What to do, in this order</h2>
              <ol>
                {sheet.sheet.fixes.map((fix) => (
                  <li key={fix.title}>
                    <strong>{fix.title}</strong> — {fix.why}
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2>What it costs to have done</h2>
              <p>
                <strong>
                  {sheet.sheet.offer.name} — {sheet.sheet.offer.price}
                </strong>
                . {sheet.sheet.offer.what}
              </p>
              <p>
                <strong>
                  {sheet.sheet.companion.name} — {sheet.sheet.companion.price}
                </strong>
                . {sheet.sheet.companion.what}
              </p>
              <p className="pitch-all">
                All four packages: {OFFERS.map((offer) => `${offer.name} ${offer.price}`).join(" · ")}
              </p>
            </section>

            <footer>
              <p>
                Checked on {sheet.sheet.date} — {sheet.sheet.checked.charAt(0).toLowerCase() + sheet.sheet.checked.slice(1)}{" "}
                Nothing on this sheet was guessed from a screenshot: every line is a fact read from the live page.
              </p>
              <p>
                SiteBuildup · <a href="https://kaysie.sitebuildup.co.uk">kaysie.sitebuildup.co.uk</a>
              </p>
            </footer>
          </article>

          <details className="pitch-email">
            <summary>The email that goes with it</summary>
            <p className="small muted">
              Two faults, what they cost, one offer, one question. Edit it in your mail client — this is the shape, not a
              template to trust blindly.
            </p>
            <pre>{`Subject: ${emailDraft(sheet.sheet).subject}\n\n${emailDraft(sheet.sheet).body}`}</pre>
          </details>
        </>
      )}
    </div>
  );
}
