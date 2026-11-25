import { useMemo, useState } from "react";
import {
  AREA_LABEL,
  AREA_NOTE,
  STANDARDS,
  STATE_LABEL,
  byArea,
  gaps,
  tally,
  type StandardArea,
  type StandardState,
} from "../siteStandards";

const STATE_CLASS: Record<StandardState, string> = { yes: "is-yes", partial: "is-partial", no: "is-no" };

/**
 * The board: every line a site is expected to have, scored for the shop and for
 * the band's site, with the two examples that show the line done well — one
 * from the UK, one from elsewhere — and the place in the repository where it
 * lives, or the reason it does not.
 */
export function Standards() {
  const [only, setOnly] = useState<"all" | "gaps">("all");
  const [site, setSite] = useState<"shop" | "band">("shop");
  const sections = useMemo(() => byArea(STANDARDS), []);
  const scores = useMemo(() => ({ shop: tally("shop"), band: tally("band") }), []);
  const next = useMemo(() => gaps(site).slice(0, 6), [site]);
  const shown = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          entries: section.entries.filter((entry) => only === "all" || entry[site] !== "yes"),
        }))
        .filter((section) => section.entries.length),
    [sections, only, site]
  );

  return (
    <div className="standards">
      <div className="standards-bar">
        <div className="standards-scores">
          {(["shop", "band"] as const).map((which) => (
            <button
              key={which}
              type="button"
              className={`standards-score${site === which ? " is-on" : ""}`}
              aria-pressed={site === which}
              onClick={() => setSite(which)}
            >
              <strong>{scores[which].score}%</strong>
              <span>{which === "shop" ? "Hearth & Grain" : "sitebuildup.co.uk"}</span>
              <small>
                {scores[which].yes} in place · {scores[which].partial} partly · {scores[which].no} missing
              </small>
            </button>
          ))}
        </div>
        <div className="standards-toggle" role="group" aria-label="Which lines to show">
          <button type="button" className={only === "all" ? "is-on" : ""} aria-pressed={only === "all"} onClick={() => setOnly("all")}>
            Everything ({STANDARDS.length})
          </button>
          <button type="button" className={only === "gaps" ? "is-on" : ""} aria-pressed={only === "gaps"} onClick={() => setOnly("gaps")}>
            Not done yet ({STANDARDS.filter((entry) => entry[site] !== "yes").length})
          </button>
        </div>
      </div>

      <div className="standards-next">
        <p className="eyebrow">Next six for {site === "shop" ? "the shop" : "the band"}</p>
        <ol>
          {next.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.title}</strong>
              <span className={`std-state ${STATE_CLASS[entry[site]]}`}>{STATE_LABEL[entry[site]]}</span>
              <p>{entry.why}</p>
            </li>
          ))}
        </ol>
      </div>

      {shown.map((section) => (
        <section className="standards-area" key={section.area}>
          <h2>
            {AREA_LABEL[section.area as StandardArea]}
            <span>{section.entries.length}</span>
          </h2>
          <p className="muted small">{AREA_NOTE[section.area as StandardArea]}</p>
          <ul>
            {section.entries.map((entry) => (
              <li key={entry.id}>
                <div className="std-head">
                  <strong>{entry.title}</strong>
                  <span className={`std-state ${STATE_CLASS[entry.shop]}`}>shop: {STATE_LABEL[entry.shop]}</span>
                  <span className={`std-state ${STATE_CLASS[entry.band]}`}>band: {STATE_LABEL[entry.band]}</span>
                </div>
                <p>{entry.why}</p>
                <p className="std-where">{entry.where}</p>
                <div className="std-best">
                  <span>Done well:</span>
                  {entry.best.map((example) => (
                    <a key={example.href} href={example.href} target="_blank" rel="noopener noreferrer" title={example.why}>
                      {example.label} ↗
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
