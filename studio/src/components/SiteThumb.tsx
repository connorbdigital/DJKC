import { useEffect, useState } from "react";

/**
 * The card a link makes when you paste it somewhere: `og:image`, its title, its
 * one line. Read by /api/site (a browser cannot fetch another site), cached, and
 * quiet when there is nothing to show.
 *
 * Lifted out of the Atlas so a project's space can show the same card for a page
 * as the detail panel does: one card, two rooms.
 */
export function SiteThumb({ url, label }: { url: string; label: string }) {
  const [preview, setPreview] = useState<{ image: string; title: string; description: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "failed">("loading");

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    setState("loading");
    setPreview(null);
    fetch(`/api/site?thumb=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { ok?: boolean; preview?: { image: string; title: string; description: string } }) => {
        if (!data?.ok || !data.preview) {
          setState("failed");
          return;
        }
        setPreview(data.preview);
        setState(data.preview.image ? "ready" : "none");
      })
      .catch(() => setState("failed"))
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url]);

  if (state === "loading") return <p className="atlas-thumb-state">Reading the card for this link…</p>;
  if (state === "failed") return <p className="atlas-thumb-state">That page would not answer, so there is no card for it.</p>;
  if (state === "none")
    return (
      <p className="atlas-thumb-state">
        {preview?.title ? `“${preview.title}” — no picture to show.` : "That page declares no picture to show."}
      </p>
    );
  if (!preview) return null;

  return (
    <figure className="atlas-thumb-card">
      <img
        src={preview.image}
        alt={preview.title ? `Preview of ${preview.title}` : `Preview of ${label}`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {preview.title && <figcaption>{preview.title}</figcaption>}
      {preview.description && <p>{preview.description}</p>}
    </figure>
  );
}
