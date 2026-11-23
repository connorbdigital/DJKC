import { useEffect, useState, type FormEvent } from "react";
import { BOOKING_EMAIL } from "../data";
import { Icon } from "./Icons";

export const UPDATES_DELAY_MS = 15000;
export const UPDATES_STORAGE_KEY = "kc-updates-seen";
const RECALL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function seenRecently() {
  try {
    const at = Number(localStorage.getItem(UPDATES_STORAGE_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < RECALL_MS;
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(UPDATES_STORAGE_KEY, String(Date.now()));
  } catch {
    /* private mode — the pop-up simply returns next visit */
  }
}

export function UpdatesSignup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");

  const close = () => {
    setOpen(false);
    remember();
  };

  useEffect(() => {
    if (seenRecently()) return;
    let timer = 0;
    const reveal = () => {
      /* Never interrupt the booking chat; try again once it is closed. */
      if (document.querySelector("dialog[open]")) {
        timer = window.setTimeout(reveal, 8000);
        return;
      }
      setOpen(true);
      window.dispatchEvent(new Event("kc:updates-open"));
    };
    timer = window.setTimeout(reveal, UPDATES_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email)) {
      setError("That email doesn't look right");
      return;
    }
    setError("");
    remember();
    const subject = "DJ KC updates list";
    const body = "Please add me to the DJ KC updates list.";
    setDraft(`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  if (!open) return null;

  return (
    <aside className="kc-updates" role="dialog" aria-modal="false" aria-labelledby="kc-updates-title" aria-describedby="kc-updates-copy">
      <button className="kc-updates-close" onClick={close} aria-label="Close updates sign-up">
        <Icon name="x" className="h-4 w-4" />
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-magenta">Updates list</p>
      <h2 id="kc-updates-title" className="mt-2 font-display text-lg font-extrabold">
        Get the next dates first
      </h2>

      {draft ? (
        <>
          <p id="kc-updates-copy" className="mt-2 text-sm leading-relaxed text-dim">
            Your email app should have opened with the message ready. Send it and KC will add you to the list.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold text-night" href={draft}>
              Open email app
            </a>
            <button className="text-sm font-semibold text-ink underline underline-offset-4" onClick={close}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p id="kc-updates-copy" className="mt-2 text-sm leading-relaxed text-dim">
            One short email when new North West dates, mixes or ticket links land. No spam, and you can leave any time.
          </p>
          <form className="mt-4" onSubmit={submit} noValidate>
            <label htmlFor="kc-updates-email" className="sr-only">
              Your email address
            </label>
            <div className="flex gap-2">
              <input
                id="kc-updates-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@venue.co.uk"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "kc-updates-error" : undefined}
                className="min-w-0 flex-1 rounded-xl border border-white/25 bg-night px-3 py-2.5 text-base text-ink placeholder:text-dim focus:border-magenta"
              />
              <button className="btn-primary shrink-0 rounded-xl px-4 text-sm font-bold text-night" type="submit">
                Join
              </button>
            </div>
            {error && (
              <p id="kc-updates-error" role="alert" className="mt-2 text-xs text-danger">
                {error}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-faint">
              This opens an email for you to send — nothing is stored on this site.
            </p>
          </form>
        </>
      )}
    </aside>
  );
}
