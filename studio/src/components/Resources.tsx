import { useMemo, useState } from "react";
import {
  EFFORT_LABEL,
  ENV_KEYS,
  LINK_GROUP_LABEL,
  LINK_GROUP_NOTE,
  LINKS,
  STATE_LABEL,
  STATE_NOTE,
  TODOS,
  linksByGroup,
  shelfAsMarkdown,
  todosByState,
  type LinkGroup,
  type TodoState,
  type TodoWhere,
} from "../resources";

const STATES: TodoState[] = ["now", "next", "later"];
const GROUPS: LinkGroup[] = ["supply", "market", "research", "providers", "this-project"];

const WHERE_LABEL: Record<TodoWhere, string> = {
  studio: "Studio",
  site: "Site",
  commerce: "Commerce",
  repo: "Repo",
  ops: "Ops",
};

function host(href: string) {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/**
 * The shelf: what to do next and where everything lives.
 *
 * Nothing here talks to GitHub, so it works before a token is pasted and keeps
 * working if GitHub is having a bad day. The todos are the same list the last
 * hand-over ended on — if one is done, it gets deleted from `resources.ts`
 * rather than ticked, because a list of finished work is a list nobody reads.
 */
export function Resources() {
  const [where, setWhere] = useState<TodoWhere | "all">("all");
  const [copied, setCopied] = useState(false);

  const counts = useMemo(
    () => ({
      now: todosByState("now").length,
      next: todosByState("next").length,
      later: todosByState("later").length,
    }),
    []
  );

  const copy = async () => {
    const text = shelfAsMarkdown();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="shelf">
      <section className="shelf-todo" aria-label="What is left to do">
        <div className="shelf-head">
          <h2>The todo</h2>
          <p className="muted small">
            {counts.now} now · {counts.next} next · {counts.later} later — {TODOS.length} in all. A finished item is
            deleted, not ticked.
          </p>
          <button className="btn ghost small-btn" type="button" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy as Markdown"}
          </button>
        </div>

        <div className="shelf-filter" role="group" aria-label="Filter by where the work happens">
          {(["all", "ops", "site", "studio", "commerce", "repo"] as const)
            /* A filter that can only ever show nothing is a dead end, so it is
               not offered at all. */
            .filter((option) => option === "all" || TODOS.some((todo) => todo.where === option))
            .map((option) => (
              <button
                key={option}
                type="button"
                className={`chip${where === option ? " is-on" : ""}`}
                aria-pressed={where === option}
                onClick={() => setWhere(option)}
              >
                {option === "all" ? "Everything" : WHERE_LABEL[option]}
                <span>{option === "all" ? TODOS.length : TODOS.filter((todo) => todo.where === option).length}</span>
              </button>
            ))}
        </div>

        <div className="shelf-columns">
          {STATES.map((state) => {
            const items = todosByState(state).filter((todo) => where === "all" || todo.where === where);
            return (
              <div key={state} className={`shelf-column is-${state}`}>
                <div className="shelf-column-head">
                  <h3>{STATE_LABEL[state]}</h3>
                  <span className="pill small">{items.length}</span>
                </div>
                <p className="muted small">{STATE_NOTE[state]}</p>
                {items.length === 0 && <p className="muted small">Nothing here for that filter.</p>}
                <ul>
                  {items.map((todo) => (
                    <li key={todo.id}>
                      <strong>{todo.title}</strong>
                      <p>{todo.why}</p>
                      <div className="shelf-meta">
                        <span className="tag">{WHERE_LABEL[todo.where]}</span>
                        <span className="tag is-effort" title={EFFORT_LABEL[todo.effort]}>
                          {todo.effort}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Links">
        <div className="shelf-head">
          <h2>Links</h2>
          <p className="muted small">
            {LINKS.length} addresses, each with the reason to open it. The sourcing ones are the same list as{" "}
            <a href="https://github.com/connorbdigital/DJKC/blob/main/commerce/SUPPLIERS.md" target="_blank" rel="noopener noreferrer">
              commerce/SUPPLIERS.md
            </a>
            .
          </p>
        </div>
        <div className="shelf-groups">
          {GROUPS.map((group) => (
            <div key={group} className="shelf-group">
              <h3>{LINK_GROUP_LABEL[group]}</h3>
              <p className="muted small">{LINK_GROUP_NOTE[group]}</p>
              <ul>
                {linksByGroup(group).map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                    <span className="shelf-host">{host(link.href)}</span>
                    <p>{link.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Keys and accounts">
        <div className="shelf-head">
          <h2>Keys</h2>
          <p className="muted small">
            Set in Vercel → project → Settings → Environment Variables, then <strong>redeploy</strong>: a variable added
            now never reaches a build that already exists. Values are write-only — this page lists names, never secrets.
          </p>
        </div>
        <div className="shelf-keys">
          <table>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Project</th>
                <th scope="col">Unlocks</th>
                <th scope="col">Without it</th>
              </tr>
            </thead>
            <tbody>
              {ENV_KEYS.map((entry) => (
                <tr key={`${entry.project}-${entry.key}`}>
                  <td>
                    <code>{entry.key}</code>
                  </td>
                  <td>
                    <span className="tag">{entry.project}</span>
                  </td>
                  <td>{entry.what}</td>
                  <td className="muted">{entry.without}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
