/**
 * Writes one page per process in the library.
 *
 *   npm run pages:processes   (runs after `vite build`, into dist/process/)
 *
 * The Atlas already draws each process as a star, but a star is a place, not a
 * page: you cannot read it without the 3D renderer, link to it from outside, or
 * hand it to someone who is not in the space. These are the same twenty
 * processes as plain HTML — what it is, why it exists, what breaks without it,
 * every file it writes, and the steps a human still has to do. Nothing is
 * invented here: it is the feature library, rendered.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPABILITIES, CATEGORIES, categoryInfo } from "../src/features";

const OUT = path.resolve("dist", "process");

const esc = (value: string) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const STAMP = new Date().toISOString().slice(0, 10);
const SITE = "https://studio-connorbdigital.vercel.app";
const REPO = "https://github.com/connorbdigital/DJKC/blob/main/studio";

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#07040d;color:#f4efff;font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#8ef0d0;text-decoration:none}
a:hover{color:#fff}
.wrap{max-width:880px;margin:0 auto;padding:26px 20px 72px}
.top{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff1f;padding-bottom:16px;margin-bottom:32px}
.brand{font:700 13px/1 ui-monospace,monospace;letter-spacing:.24em;text-transform:uppercase;color:#fff;border:1px solid #7c5cff;padding:9px 11px;border-radius:8px}
nav{display:flex;flex-wrap:wrap;gap:16px;font:500 12px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}
nav a{color:#a99cbd}
.eyebrow{font:500 11px/1 ui-monospace,monospace;letter-spacing:.3em;text-transform:uppercase;color:#b9a5ff;margin:0 0 14px}
h1{font-size:clamp(28px,5vw,44px);line-height:1.08;margin:0 0 16px;letter-spacing:-.02em}
h2{font-size:21px;line-height:1.25;margin:38px 0 10px}
h3{font-size:16px;margin:22px 0 6px}
p{color:#d9cdf0;margin:0 0 14px;max-width:70ch}
ul,ol{color:#d9cdf0;padding-left:20px;max-width:70ch}
li{margin:0 0 7px}
.lede{font-size:18px;color:#f0e8fa}
.card{border:1px solid #ffffff1f;border-radius:16px;padding:18px 20px;margin:16px 0;background:#ffffff08}
.warn{border-color:#ff2bd655;background:#ff2bd612}
table{width:100%;border-collapse:collapse;margin:10px 0 8px;font-size:14px}
th,td{text-align:left;padding:10px;border-bottom:1px solid #ffffff1a;vertical-align:top}
th{font:500 10px/1.7 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#9b8ab0}
code{font:13px/1.5 ui-monospace,monospace;color:#8ef0d0;background:#ffffff0d;padding:1px 5px;border-radius:5px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0;padding:0;list-style:none}
.chips li{border:1px solid #ffffff24;border-radius:999px;padding:4px 11px;font:500 11px/1.4 ui-monospace,monospace;letter-spacing:.08em;color:#c9bbd8}
.foot{margin-top:48px;border-top:1px solid #ffffff1f;padding-top:18px;font-size:13px;color:#9b8ab0}
.muted{color:#9b8ab0;font-size:13px}
`;

function page(capability: (typeof CAPABILITIES)[number], index: number) {
  const shelf = categoryInfo(capability.category);
  const previous = CAPABILITIES[(index - 1 + CAPABILITIES.length) % CAPABILITIES.length];
  const next = CAPABILITIES[(index + 1) % CAPABILITIES.length];
  const url = `${SITE}/process/${capability.id}.html`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: capability.name,
    headline: capability.name,
    description: capability.summary,
    url,
    inLanguage: "en-GB",
    version: capability.version,
    dateModified: STAMP,
    author: { "@type": "Organization", name: "The Studio" },
    about: { "@type": "SoftwareApplication", name: "KC Studio", applicationCategory: "BusinessApplication", url: SITE },
    isPartOf: { "@type": "WebSite", name: "KC Studio", url: SITE },
    keywords: [capability.category, ...capability.env, ...capability.requires].join(", "),
  };
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(capability.name)} — a process in the Studio library</title>
<meta name="description" content="${esc(capability.summary.slice(0, 175))}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="noindex, follow" />
<meta property="og:title" content="${esc(capability.name)}" />
<meta property="og:description" content="${esc(capability.summary.slice(0, 175))}" />
<meta property="og:url" content="${url}" />
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="${SITE}/#atlas">The Studio</a>
    <nav aria-label="Processes">
      <a href="${SITE}/#atlas">Atlas</a>
      <a href="${SITE}/#tab=processes">Processes</a>
      <a href="#" aria-current="page">${esc(shelf?.label ?? capability.category)}</a>
    </nav>
  </header>
  <main>
    <p class="eyebrow">${esc(shelf?.label ?? capability.category)} · v${esc(capability.version)}</p>
    <h1>${esc(capability.name)}</h1>
    <p class="lede">${esc(capability.summary)}</p>

    <h2>Why it exists</h2>
    <p>${esc(capability.why)}</p>

    <div class="card warn">
      <h3 style="margin-top:0">What goes wrong without it</h3>
      <p style="margin:0">${esc(capability.without)}</p>
    </div>

    <h2>The files it installs</h2>
    <table>
      <thead><tr><th>File</th><th>What it does</th><th></th></tr></thead>
      <tbody>
${capability.files
    .map(
      (file) => `        <tr><td><code>${esc(file.path)}</code></td><td>${esc(file.role)}</td><td class="muted">${file.adapt ? "adapt" : "copy"}</td></tr>`
    )
    .join("\n")}
      </tbody>
    </table>
${capability.expects.length ? `    <h2>What it reads but never writes</h2>
    <table>
      <thead><tr><th>File</th><th>Why</th></tr></thead>
      <tbody>
${capability.expects.map((file) => `        <tr><td><code>${esc(file.path)}</code></td><td>${esc(file.role)}</td></tr>`).join("\n")}
      </tbody>
    </table>` : ""}

    <h2>What it needs</h2>
    <p>Environment: ${capability.env.length ? capability.env.map((key) => `<code>${esc(key)}</code>`).join(" ") : "nothing beyond the host"}. Installs after: ${capability.requires.length ? capability.requires.map((id) => `<a href="${SITE}/#atlas/cap-${esc(id)}">${esc(id)}</a>`).join(", ") : "nothing"}.</p>

    <h2>What a human still has to do</h2>
    ${capability.manual.length ? `<ol>${capability.manual.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : `<p>Nothing — the pull request is the whole install.</p>`}

    <p class="muted">Copied from <code>${esc(capability.source)}</code> · updated ${esc(STAMP)} · <a href="${REPO}" rel="noreferrer">the source in the repository</a> · <a href="${SITE}/#atlas/cap-${esc(capability.id)}">see it in the Atlas</a></p>

    <nav aria-label="Other processes" class="muted">
      <p>Previous: <a href="${previous.id}.html">${esc(previous.name)}</a> · Next: <a href="${next.id}.html">${esc(next.name)}</a></p>
      <p>Shelves: ${CATEGORIES.map((category) => `${esc(category.label)} (${CAPABILITIES.filter((entry) => entry.category === category.id).length})`).join(" · ")}</p>
    </nav>
  </main>
  <footer class="foot">
    <p><strong>The Studio</strong> — every project, every shipped feature, and the processes that build them. This page is generated from <code>studio/src/features.ts</code>; nothing on it is written by hand.</p>
  </footer>
</div>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const [index, capability] of CAPABILITIES.entries()) {
  writeFileSync(path.join(OUT, `${capability.id}.html`), page(capability, index), "utf8");
}
console.log(`process pages written: ${CAPABILITIES.length} → dist/process/`);
