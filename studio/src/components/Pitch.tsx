import { useState } from "react";
import { checkUrl, type SiteReport } from "../sitecheck";
import { buildPitch, OFFERS, pitchText, type Pitch as PitchSheet } from "../pitch";

/**
 * A URL in, a one-page argument out.
 *
 * The sheet is what gets printed or pasted into an email: five findings with what
 * each costs, three things to do first, and the package that fits. It is built
 * from the same audit the Atlas runs, so it cannot disagree with the Studio.
 */
export function Pitch() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<PitchSheet | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setError("");
    setCopied(false);
    const verdict = checkUrl(url);
    if (!verdict.ok || !verdict.url) {
      setError(verdict.reason ?? "That URL cannot be checked.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: verdict.url.toString() }),
      });
      const data = (await response.json().catch(() => null)) as { ok: true; report: SiteReport } | { ok: false; error: string } | null;
      if (!data) throw new Error(`The audit endpoint answered ${response.status}.`);
      if (!data.ok) throw new Error(data.error);
      setSheet(buildPitch(data.report, verdict.url.toString()));
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "The page could not be audited.";
      setError(
        /404|405|unexpected token|failed to fetch|not found/i.test(message)
          ? "The audit runs on the deployed Studio (/api/site), not on a dev server. Open the deployed URL, or paste a site that allows being read."
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!sheet) return;
    try {
      await navigator.clipboard.writeText(pitchText(sheet));
      setCopied(true);
    } catch {
      setError("The clipboard refused. Select the sheet and copy it by hand.");
    }
  };

  return (
    <div className="pitch">
      <form
        className="pitch-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <label htmlFor="pitch-url">A prospect's URL</label>
        <input
          id="pitch-url"
          type="url"
          inputMode="url"
          placeholder="https://example.co.uk"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          spellCheck={false}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Reading the page…" : "Build the sheet"}
        </button>
      </form>
      <p className="muted small pitch-intro">
        The sheet says what is wrong, what each fault costs, what to do first, and which of the four packages fits. Print
        it to PDF, or copy it into an email. The audit reads the public page only — nothing is signed up to, nothing is
        written back.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      {sheet && (
        <>
          <div className="pitch-actions">
            <button className="btn" type="button" onClick={() => window.print()}>Print / save as PDF</button>
            <button className="btn ghost" type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy as text"}</button>
          </div>

          <article className="pitch-sheet">
            <header>
              <p className="eyebrow">SiteBuildup · site check</p>
              <h1>{sheet.headline}</h1>
              <p className="pitch-meta">
                {sheet.url.replace(/^https?:\/\//, "")} · {sheet.passes} of {sheet.passes + sheet.findings.length} checks
                passing · score {sheet.score}%
              </p>
            </header>

            {sheet.findings.length ? (
              <section>
                <h2>What is wrong, worst first</h2>
                <ol>
                  {sheet.findings.map((finding) => (
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
                {sheet.fixes.map((fix) => (
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
                  {sheet.offer.name} — {sheet.offer.price}
                </strong>
                . {sheet.offer.what}
              </p>
              <p>
                <strong>
                  {sheet.companion.name} — {sheet.companion.price}
                </strong>
                . {sheet.companion.what}
              </p>
              <p className="pitch-all">All four packages: {OFFERS.map((offer) => `${offer.name} ${offer.price}`).join(" · ")}</p>
            </section>

            <footer>
              <p>
                Checked on {sheet.date} — {sheet.checked.charAt(0).toLowerCase() + sheet.checked.slice(1)} Nothing on this
                sheet was guessed from a screenshot: every line is a fact read from the live page.
              </p>
              <p>SiteBuildup · <a href="https://kaysie.sitebuildup.co.uk">kaysie.sitebuildup.co.uk</a></p>
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
