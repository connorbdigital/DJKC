/**
 * Downloads a supplier feed and files it where the catalogue builder can see it.
 *
 *   npm run feed -- --url "https://supplier.example/feed.csv?u=you@example.com" --name aosom
 *   FEED_URL=... FEED_AUTH_HEADER="Bearer …" npm run feed
 *
 * What it does:
 *   - refuses anything that is not https, or that tucks the account into the URL
 *   - downloads with a timeout, and fails loudly on a non-200 or an empty body
 *   - writes `feeds/<name>-<date>.csv` (dated, so yesterday's file survives)
 *   - appends a redacted record to `feeds/manifest.json`: url shape, bytes,
 *     SHA-256, row count, columns and which supplier profile it looks like
 *   - prints the next command to build the catalogue from it
 *
 * Credentials are read from the environment or CLI flags and are never written
 * to disk, never logged, and never included in the manifest.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  checkFeedUrl,
  describeFeed,
  feedFileName,
  mergeManifest,
  redactUrl,
  type FeedManifest,
  type FeedRecord,
} from "../src/feedSource";

const FEEDS = path.resolve("feeds");

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    name: { type: "string", default: "supplier" },
    header: { type: "string", multiple: true, default: [] },
    user: { type: "string" },
    pass: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const usage = `Usage
  npm run feed -- --url <https url> [--name aosom] [--header "Authorization: Bearer …"]
                 [--user you@example.com --pass …]

Environment (so the command does not end up in your shell history with a token)
  FEED_URL, FEED_NAME, FEED_AUTH_HEADER, FEED_USER, FEED_PASS

Then
  npm run catalogue -- feeds/<file>.csv
`;

const die = (message: string): never => {
  console.error(`\n${message}\n`);
  if (/url/i.test(message)) console.error(usage);
  process.exit(1);
};

const url = values.url ?? process.env.FEED_URL;
if (values.help || !url) die(values.help ? usage : "No --url given. A supplier feed needs a URL.");

const check = checkFeedUrl(url);
if (!check.ok) die(`Refused: ${check.reason}.`);

const name = values.name ?? process.env.FEED_NAME ?? "supplier";
const headers: Record<string, string> = { accept: "text/csv, text/plain, */*" };
const authHeader = values.header.length ? values.header.join(" ") : process.env.FEED_AUTH_HEADER;
if (authHeader) {
  const [headerName, ...rest] = authHeader.split(":");
  if (!headerName || rest.length === 0) die("--header must look like 'Authorization: Bearer …'.");
  headers[headerName!.trim()] = rest.join(":").trim();
}
const user = values.user ?? process.env.FEED_USER;
const pass = values.pass ?? process.env.FEED_PASS;
if (user) headers.authorization = `Basic ${Buffer.from(`${user}:${pass ?? ""}`).toString("base64")}`;

const download = async (): Promise<string> => {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (!response.ok) die(`The supplier answered ${response.status} ${response.statusText}. Check the URL and the credentials.`);
  const text = await response.text();
  if (!text.trim()) die("The supplier returned an empty file. Usually that means the account is not active yet.");
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html") && /<html/i.test(text.slice(0, 500))) {
    die("That returned an HTML page, not a feed — probably a login screen. Use the feed URL from the portal, not the portal URL.");
  }
  return text;
};

const run = async () => {
  const text = await download();
  const summary = describeFeed(text);
  if (!summary.columns.length) die("No header row found. That does not look like a CSV.");

  await mkdir(FEEDS, { recursive: true });
  const file = feedFileName(name, new Date());
  await writeFile(path.join(FEEDS, file), text, "utf8");

  const entry: FeedRecord = {
    file,
    url: redactUrl(url),
    fetchedAt: new Date().toISOString(),
    bytes: summary.bytes,
    sha256: createHash("sha256").update(text).digest("hex"),
    rows: summary.rows,
    columns: summary.columns,
    profile: summary.profile?.id ?? "generic",
    ragged: summary.ragged,
  };

  let existing: FeedManifest | undefined;
  try {
    existing = JSON.parse(await readFile(path.join(FEEDS, "manifest.json"), "utf8")) as FeedManifest;
  } catch {
    /* first run */
  }
  const manifest = mergeManifest(existing, entry);
  await writeFile(path.join(FEEDS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`saved     feeds/${file}`);
  console.log(`source    ${entry.url}`);
  console.log(`rows      ${summary.rows}${summary.ragged ? ` (${summary.ragged} ragged)` : ""}`);
  console.log(`columns   ${summary.columns.slice(0, 8).join(", ")}${summary.columns.length > 8 ? ` … +${summary.columns.length - 8}` : ""}`);
  console.log(`profile   ${summary.profile ? `${summary.profile.label} (${summary.profile.id})` : "unrecognised — the generic column map will be used"}`);
  if (!summary.looksLikeProducts) {
    console.log("warning   no obvious product columns. A stock or order file needs the product file alongside it.");
  }
  console.log(`sha256    ${entry.sha256.slice(0, 16)}…`);
  console.log(`\nnext      npm run catalogue -- feeds/${file}`);
};

run().catch((error: unknown) => die(error instanceof Error ? `Download failed: ${error.message}` : "Download failed."));
