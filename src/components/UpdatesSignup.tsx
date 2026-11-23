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
  const [state, setState] = useState<"idle" | "saving" | "subscribed" | "fallback">("idle");

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email)) {
      setError("That email doesn't look right");
      return;
    }
    setError("");
    setState("saving");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error("not stored");
      remember();
      setState("subscribed");
    } catch {
      /* No storage configured or the request failed: fall back to a prepared email. */
      remember();
      const subject = "DJ KC updates list";
      const body = "Please add me to the DJ KC updates list.";
      setDraft(`mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      setState("fallback");
    }
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

      {state === "subscribed" ? (
        <>
          <p id="kc-updates-copy" className="mt-2 text-sm leading-relaxed text-dim">
            You&rsquo;re on the list. You&rsquo;ll hear first when new North West dates, mixes or ticket links land — and you
            can unsubscribe from any email.
          </p>
          <button className="btn-primary mt-4 rounded-full px-5 py-2.5 text-sm font-bold text-night" onClick={close}>
            Done
          </button>
        </>
      ) : draft ? (
        <>
          <p id="kc-updates-copy" className="mt-2 text-sm leading-relaxed text-dim">
            That didn&rsquo;t save just now, so we&rsquo;ve opened an email instead. Send it and KC will add you by hand.
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
              <button
                className="btn-primary shrink-0 rounded-xl px-4 text-sm font-bold text-night disabled:opacity-60"
                type="submit"
                disabled={state === "saving"}
              >
                {state === "saving" ? "Joining…" : "Join"}
              </button>
            </div>
            {error && (
              <p id="kc-updates-error" role="alert" className="mt-2 text-xs text-danger">
                {error}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Kept only to send DJ KC updates. Unsubscribe any time.
            </p>
          </form>
        </>
      )}
    </aside>
  );
}
