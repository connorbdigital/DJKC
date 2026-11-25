import { useEffect, useMemo, useRef, useState } from "react";
import { matchCommands, type Command } from "../palette";

/**
 * ⌘K, the way everything else works. Every command here is a tab or a node that
 * already has a link, so the palette never invents an action.
 */
export function Palette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => matchCommands(query, commands), [query, commands]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setActive(0), [query]);

  const pick = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  return (
    <div
      className="palette-scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={input}
          className="palette-input"
          placeholder="Go to a tab, or jump to a node…"
          aria-label="Command"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => (results.length ? (current + 1) % results.length : 0));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              pick(results[active]);
            }
          }}
        />
        <ul className="palette-list">
          {results.length === 0 && <li className="palette-empty">Nothing matches “{query}”.</li>}
          {results.map((command, index) => (
            <li key={command.id}>
              <button
                className={`palette-item${index === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(command)}
              >
                <span>{command.label}</span>
                {command.hint && <span className="palette-hint">{command.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="palette-foot">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>↵</kbd> to go, <kbd>esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
