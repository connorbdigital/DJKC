/**
 * Searching every project at once, through GitHub's own code search.
 *
 * The API only searches a default branch and refuses a query with no
 * org/user/repo qualifier, so the qualifier is built here rather than left to
 * whoever typed the box. Results are flattened into something a human can
 * scan: which repository, which file, and the matching lines.
 */

export interface CodeMatch {
  repo: string;
  path: string;
  url: string;
  /** Snippets GitHub highlighted, already stripped of markup. */
  fragments: string[];
}

export interface CodeSearchResult {
  term: string;
  total: number;
  matches: CodeMatch[];
  /** True when the API had more than we asked for. */
  truncated: boolean;
}

export interface QueryContext {
  /** GitHub login, used for `user:` when no single repository is chosen. */
  login?: string;
  /** owner/name, when the search is limited to one project. */
  repo?: string;
  language?: string;
}

export const MAX_TERM = 120;

/** GitHub syntax, assembled safely: qualifiers are ours, the text is theirs. */
export function buildCodeQuery(term: string, context: QueryContext): string {
  const clean = term.replace(/\s+/g, " ").trim().slice(0, MAX_TERM);
  if (!clean) throw new Error("Type something to search for.");
  const parts = [clean];
  if (context.repo) parts.push(`repo:${context.repo}`);
  else if (context.login) parts.push(`user:${context.login}`);
  else throw new Error("Choose a project or sign in so the search has a scope.");
  if (context.language) parts.push(`language:${context.language}`);
  return parts.join(" ");
}

interface RawTextMatch {
  fragment?: string;
}

interface RawItem {
  repository?: { full_name?: string };
  path?: string;
  html_url?: string;
  text_matches?: RawTextMatch[];
}

export interface RawSearchResponse {
  total_count?: number;
  items?: RawItem[];
}

const stripMarkup = (fragment: string): string =>
  fragment
    .replace(/<\/?em>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseCodeSearch(raw: RawSearchResponse, term: string, limit = 30): CodeSearchResult {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const matches: CodeMatch[] = items
    .filter((item) => item.repository?.full_name && item.path)
    .map((item) => ({
      repo: item.repository!.full_name!,
      path: item.path!,
      url: item.html_url ?? "",
      fragments: (item.text_matches ?? [])
        .map((match) => stripMarkup(match.fragment ?? ""))
        .filter(Boolean)
        .slice(0, 3),
    }))
    .slice(0, limit);

  return {
    term,
    total: typeof raw.total_count === "number" ? raw.total_count : matches.length,
    matches,
    truncated: (raw.total_count ?? matches.length) > matches.length,
  };
}

/** Groups matches by repository, biggest first, for a readable list. */
export function groupByRepo(matches: CodeMatch[]): { repo: string; matches: CodeMatch[] }[] {
  const groups = new Map<string, CodeMatch[]>();
  for (const match of matches) groups.set(match.repo, [...(groups.get(match.repo) ?? []), match]);
  return [...groups.entries()]
    .map(([repo, entries]) => ({ repo, matches: entries }))
    .sort((a, b) => b.matches.length - a.matches.length || a.repo.localeCompare(b.repo));
}

/** GitHub's code search is heavily rate limited; say so instead of failing silently. */
export function explainCodeError(message: string, status: number): string {
  if (status === 403 || status === 429) {
    return "GitHub limits code search to about ten requests a minute. Wait a moment and try again.";
  }
  if (status === 422) return "GitHub could not read that query — try fewer or simpler words.";
  if (status === 401) return "The token is no longer accepted for search. Lock and unlock the Studio.";
  return message || "GitHub search did not answer.";
}
