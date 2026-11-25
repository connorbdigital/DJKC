/** One thing the palette can do. `hint` is the small line that explains it. */
export interface Command {
  id: string;
  label: string;
  hint?: string;
  /** Words that also match, when the label is not what you would type. */
  aliases?: string[];
  run: () => void;
}

const clean = (value: string) => value.trim().toLowerCase();

/** Every character of the query, in order: "srh" finds "Search". */
export function isSubsequence(query: string, label: string): boolean {
  let at = 0;
  for (const char of label) {
    if (char === query[at]) at += 1;
    if (at === query.length) return true;
  }
  return query.length === 0;
}

/** 3 = the label starts with it, 2 = a word starts with it, 1 = letters in order. */
export function scoreCommand(query: string, command: Command): number {
  const q = clean(query);
  if (!q) return 1;
  const label = clean(command.label);
  if (label.startsWith(q)) return 3;
  if (label.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 2;
  if (command.aliases?.some((alias) => clean(alias).includes(q))) return 2;
  return isSubsequence(q, label) ? 1 : 0;
}

/** Best matches first; ties keep the order they were given in, which is by tab. */
export function matchCommands<T extends Command>(query: string, commands: T[]): T[] {
  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(query, command) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.command);
}
