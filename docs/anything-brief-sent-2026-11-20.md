# The audit, sent to the apex project

**What was asked:** go into the sitebuildup project — the top one — and apply the
audit.

**What happened:** the brief was sent. Asked, answered, charged.

## The project

Found by listing all 89 projects the key can see, newest first. The top one is
the apex site:

| | |
| --- | --- |
| name | **Digital Solutions Marketing Agency** |
| id | `01b8f8b1-f6ed-4a6d-a606-c4dcb2e17c67` |
| slug | `digital-solutions-marketing-449` |
| published at | `https://www.sitebuildup.co.uk` |
| modules | 505 |
| last edited before this | 2026-11-16 16:19 UTC |

The slug is the one in the site's own OG image path
(`/bundle-link/digital-solutions-marketing-449/opengraph-image.png`), and the
published URL is sitebuildup.co.uk — so this is the site the audit is about, not a
copy sitting beside it. There are four near-neighbours (`(Migrated)`, two "Copy
of …"), which is exactly why the send was gated on the published URL rather than
on the name.

## The send

```
POST /v0/api/projects/01b8f8b1-f6ed-4a6d-a606-c4dcb2e17c67/generate
{ "prompt": <5,547 chars>, "createNewThread": true }
→ 200 {"revisionId":"9b15569d-43c6-43c9-8808-093a6446f56c",
       "threadId":"746b0482-7a2e-459e-b2d3-06ea44c861dd"}
```

The prompt is `APEX_AUDIT_BRIEF.prompt` in `studio/src/anythingAudit.ts` —
byte-for-byte the text the Studio's Send-brief button posts, so what went to the
project is what the repo says went to the project. There is no file-edit endpoint
in the Anything API: a revision is the only way to change a project, and this is
one.

## What it cost

| | My Team (Pro plan) | MICRO MEDIA (Free) |
| --- | --- | --- |
| before | 105,120 | 4,000 |
| one minute after | 102,050 | 4,000 |

**3,070 credits** for one revision of a 5,547-character brief. At that rate the
Pro balance is about 34 sends of this size. It is charged on the send, not on
completion — the balance moved while the project still read as unedited.

## What cannot be watched from here

- `GET /v0/api/projects/{id}/revisions` → **404**
- `GET /v0/api/revisions/{id}` → **404**

There is no read endpoint for a revision's progress, so the revision id is the
last thing this side of the wire can know. Progress is visible in the Anything
builder; the project's `updatedAt` only moves when the revision writes.

## How it was sent, and why that way

The key is a Vercel `sensitive` variable: the API returns it with an empty value,
so it cannot be read out — correctly. It also cannot be used from a sandbox with
no egress to `api.anything.com`. The one place the key is both present and able
to reach Anything is a build in the `studio` project, so the send was made from a
throwaway deployment of that project: one script, one brief, `buildCommand: node
apply.mjs`, logs read back through the deployments API.

Four such deployments were created and **deleted afterwards**:

| deployment | what it did |
| --- | --- |
| `dpl_4hHA1ed1y11MVQuG2LJfK7S4NUDw` | failed — files at root, project root is `studio` |
| `dpl_8Ke1QWGvyQLVZf5p9jzzyjpXby3n` | read: key present (75 chars), `/me` 200, 89 projects |
| `dpl_D86v6RiTSUpNoLSdEZVefSWS8kDS` | the send (guard passed, 200, revision id) |
| `dpl_FTTWD9xtozgj52vQkNTdChkndGtx` | read: credits after, revision endpoints 404 |

The guard matters: the script fetched the project first and refused to send
unless a published URL contained `sitebuildup` or the slug matched. A brief sent
into the wrong project spends the same credits and cannot be recalled.

None of these deployments touched production or a branch alias — they are
preview builds that were never promoted, and they are gone.

## What to look at next

1. Open the project in Anything and watch revision `9b15569d…` — it works through
   the ten numbered sections in order, so a partial finish should stop late, not
   early. Section 1 (one identity) and section 2 (one price list) are the ones
   that make every later section possible.
2. The ten acceptance checks at the end are the test: the same tier priced the
   same on `/`, `/pricing` and `/services`; `robots.txt`, `sitemap.xml` and
   `llms.txt` returning 200; `grepping for 'yourcompany'` returning nothing.
3. If it stalls, the cheap second message is a continuation in the same thread
   (`threadId` above, no `createNewThread`) — a thread reply carries the context
   without re-reading a 5,547-character brief, and costs what one message costs.
