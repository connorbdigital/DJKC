# Anything: what it is, what we reuse, what is left on the table

Written 20 November 2026, after the Anything bridge was confirmed working on the
live Studio (`/api/anything?probe=1` → `scheme:"basic"`, `status:200`,
`accepted:true`).

Two separate questions, answered separately:

1. **What can the Anything API do?** — the whole surface, from the OpenAPI
   document and the docs index, not from memory.
2. **What of it is reusable in the Studio?** — a verdict per row: *reused*,
   *worth copying*, or *not for us, and why*.

---

## 1. The one thing that actually broke, and the shape of the fix

The bridge speaks Anything's own auth: **the key as the Basic username, empty
password**. Anything's docs print that as `anything_xxx:`, and a pasted value
carrying the trailing colon, or the key pasted twice, is what produced a 401
that looked like a dead key.

What that left behind in the Studio, all of it reused:

| Piece | Where | Why it earns its place |
| --- | --- | --- |
| Key cleaning (`cleanKey`) | `studio/src/anything.ts` | Strips whitespace and the trailing `:`, so a paste from the docs works first time |
| Scheme fallback `basic → bearer → x-api-key`, cached 10 min | `studio/src/anything.ts` | One experiment per key per warm instance; a working deployment pays nothing |
| The probe | `/api/anything?probe=1`, `docs` in `anything.ts` | Names the upstream call, the scheme and the status, and says which of the configured variables Anything accepted — never a bare 500 |
| Key diagnosis (`keyShape`, `keyDiagnosis`) | `studio/src/anything.ts` | Says *length, plain characters, looks like an example* without ever echoing the value |

This is the reusable pattern, and it is the one worth copying anywhere the Studio
reads someone else's API: **one endpoint that reports what it has, what it asked,
and what came back.**

---

## 2. The Anything API, as documented

Source: `https://api.anything.com/v0/api/openapi.json` and
`https://www.anything.com/docs/llms.txt`. Every endpoint below is a real path in
that document. "Untested" means exactly that: we have only ever called `/me` and
`/projects`.

### Projects and generation

| Endpoint | What it does | Verdict |
| --- | --- | --- |
| `GET /v0/api/projects` | Projects the key can see; filter by organisation, query, limit | **Reused** — the Atlas's Anything suns and the Anything tab |
| `POST /v0/api/projects` | Create a project and start generating from a prompt | Not used: the Studio does not spend anyone's credits |
| `GET /v0/api/projects/{id}` | Project detail, modules, dev-server status | **Worth copying** — see §3.1 |
| `GET …/{id}/status` | "Small status document (latest revision + deployment summary)" for cheap polling | **Worth copying** — the pattern is the point; see §3.2 |
| `POST …/{id}/messages` (`request-a-change`) | Send a prompt to change the project; continues or starts a thread | Not used: read-only by decision |
| `GET …/{id}/messages` | Chat messages, filterable by thread | Later: "what was asked for, in the project's own words" |
| `POST …/{id}/duplicate`, `rename`, `delete`, `restore` | Lifecycle | Not used |
| `POST …/{id}/publish`, `unpublish` | Take it public, optionally claim a slug | Not used; our deploy path is Vercel |
| `GET …/{id}/files` | List files, or one file with content | Later: the project space could list real files, not just pages |
| `GET …/{id}/logs` | Recent development logs, filter by level or text | Later |

### Deployments, domains, assets

| Endpoint | What it does | Verdict |
| --- | --- | --- |
| `GET …/{id}/deployments` | Recent deployments, newest first | Same shape as our Vercel reads; no need to duplicate |
| `GET …/deployments/{id}`, `…/logs` | Deployment state and build logs | Same |
| `rollback` | Documented as **not yet implemented upstream** | Nothing to build on |
| `GET /organizations/{id}/domains`, `add`, `remove`, `verify` | Apex domains, verification, linked project | **Worth copying (idea)** — our shelf lists keys but not "which domain points where" |
| `GET …/{id}/assets`, `upload`, `delete` | Project images, multipart upload | Not now: no image workflow in the Studio |

### Data, auth, secrets

| Endpoint | What it does | Verdict |
| --- | --- | --- |
| `GET /databases`, `POST /databases`, `GET /databases/{id}`, `delete` | Provisioned Postgres per organisation; creating is async, poll until status leaves `CREATING` | Not used |
| `POST /databases/{id}/query` | **Read-only SQL**: only `SELECT`, `WITH`, `EXPLAIN`, `SHOW` | **Worth copying (idea)** — an allow-list, not a sanitiser, is how a read-only door should be built |
| `GET …/connection-string`, `POST …/reset-development` | Credentials and a dev reset | Not used: credentials should not pass through a browser-facing function |
| `GET …/{id}/auth-settings`, `PATCH` | Which providers are configured; set secrets | Not used |
| `GET …/{id}/secrets`, `POST`, `DELETE` | Secrets **without plaintext values** | **Already the model we use** — the Shelf shows names and purposes, never values |
| `GET /organizations/{id}/members`, `invite`, `remove`, `role` | Collaborators and pending invites | Not now |

### Account

| Endpoint | What it does | Verdict |
| --- | --- | --- |
| `GET /v0/api/me` | The key's user, their organisations, plan, credits | **Reused** — as the auth probe, and in the list fallback to name the orgs |

### Around the API (docs index, not endpoints)

Agent and Max (goal → build → test in a real browser → fix), CLI, mobile
builds and store submissions (Expo, TestFlight, Play Console), Stripe and
RevenueCat payments, AdMob/AdSense, 100+ named integrations, Postgres, auth,
uploads, analytics, iframe embed, teams, export, templates, Figma/Mocha/Sleek
imports.

**None of these is a component the Studio can pick up.** They are the product.
The parts that transfer are the *patterns*: a probe that names its upstream, a
cheap status endpoint for polling, secrets listed without plaintext values, and
a read-only query door defined by an allow-list.

---

## 3. What is worth copying next, in order

### 3.1 A project that is not a URL
Our `PROJECTS` record describes a project with a label, a line and a list of
pages. Anything describes one with modules, a dev server, deployments, files,
secrets and messages. The **project space** shipped today is the first half of
that idea — a room per project with its pages and the links between them — and
`GET /projects/{id}` is the shape to grow into when an Anything project is
opened from the Atlas.

### 3.2 Poll the cheap endpoint, not the expensive one
`GET …/status` exists because reading a message body to learn "is it built yet"
is wasteful. The Studio does the same thing badly in one place: the scan and the
audit both wait on a full page read. A `/api/site?status=` that answers "reachable,
status, title" without the body would cut that.

### 3.3 A read-only SQL door as an allow-list
`SELECT | WITH | EXPLAIN | SHOW` is the whole rule, written down. If the Studio
ever reads a database, that is the shape: name the four verbs, refuse the rest,
and say which one was refused.

---

## 4. What we deliberately do not reuse

- **Writes.** Create, duplicate, rename, publish, delete, invite, set secrets:
  all documented, none called. The Studio is read-only against Anything, and the
  bridge's own header says so.
- **Credits.** `POST /projects` spends money. A studio that can create projects
  by accident is a studio that costs its owner money.
- **Connection strings.** Anything returns them; we will not pass one through a
  browser-facing function.
- **Rollback.** Documented as not implemented upstream. Nothing to build.

---

## 5. Gaps, stated plainly

- Only two endpoints have ever been called: `/me` and `/projects`. Every other
  response shape in this document is the OpenAPI schema, not something we have
  seen answered.
- The `deployments`, `files`, `databases` and `assets` families have no tests in
  this repository because they have no callers.
- The Anything tab shows what the API lists. It does not cache, and it does not
  say "last seen" — reloading is how you refresh it.
- The Atlas draws an Anything project as a sun from the *list* endpoint only; if
  the list answers without a project's detail, the sun is there and the room
  behind it is empty. That is said in the space, not hidden.
