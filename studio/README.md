# Studio

A private workspace for everything built here: every project and its history, a library of features that already ship, and an agent that drafts the next change as a pull request you review.

It is a separate package with its own build and its own deploy. Nothing in it is imported by the DJ site.

```
studio/
├── api/draft.ts          serverless: talks to the model, holds the key, writes nothing
├── src/github.ts         GitHub REST client: repos, activity, files, branches, pull requests
├── src/installer.ts      copies a capability's files into another repo and opens a PR
├── src/features.ts       the feature library, copied from code that already ships
├── src/agent.ts          browser → /api/draft
└── src/components/       Gate, Projects, Features, Draft
```

## Run it

```bash
cd studio
npm install
npm run test     # registry + installer + adapters
npm run build
npm run dev      # http://localhost:5173, proxied by Vercel in production
```

## Deploy it

1. Vercel → **Add New → Project** → same repository.
2. **Root Directory: `studio`.** Framework preset Vite. Build `npm run build`, output `dist`.
3. Environment variables:
   - `ANTHROPIC_API_KEY` — only needed for the Agent tab. Without it the other tabs still work and the agent answers with a clear 503.
   - `STUDIO_MODEL` — optional, defaults to `claude-sonnet-4-5`.
4. Deploy. It is `noindex, nofollow` and should stay that way.

The Studio has **no database**. Your GitHub token is typed in and kept in that tab's `sessionStorage`; closing the tab locks it. Reads and writes go straight from the browser to `api.github.com`. The only server-side secret is the model key.

## The three tabs

**Projects** — every repository the token can see, newest first, with commits and pull requests merged into one history. This is the answer to "what's been on this project", without needing anything from Arena: Arena's work arrives here as branches and pull requests.

**Feature library** — each entry is a real capability lifted from shipped code: what it does, its files, the env vars it needs, what it depends on, and what a human still has to change. "Copy files and open a pull request" writes those files into a target repo on a `studio/feature-…` branch and opens a PR whose body lists the edits still required.

**Agent** — write a brief, tick the features it may reuse, get a proposal as whole files. Nothing is written until you press the second button, and the pull request says, in its own body, that it was model-drafted and must be reviewed.

## What it deliberately does not do

- **Merge.** No auto-merge, no force-push, no direct commits to a default branch.
- **Run code.** No execution sandbox, so nothing is tested by the Studio — that is what your CI is for.
- **Talk to Arena.** Arena has no public API for starting sessions or reading its internals. The Studio reads the GitHub output instead, and you take briefs back into Arena by hand.
- **Store secrets.** No token database, no cookies.

## Adding a capability to the library

Append to `src/features.ts`: `id`, `name`, `summary`, `source` (owner/name), `files` with a `role` and `adapt: true` where the file needs editing at the destination, `env`, `requires`, `manual`. Then `npm run test` — the suite fails if a listed file does not exist in the source project or a dependency is misspelled.
