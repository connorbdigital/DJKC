/**
 * CSV, the way suppliers actually send it.
 *
 * Quoted fields with commas and newlines inside them, CRLF line endings, a
 * byte-order mark at the start, ragged rows, and Excel's habit of writing
 * numbers as text. Parsing this properly is the difference between a catalogue
 * and a mess of shifted columns.
 */
export type Row = Record<string, string>;

export interface Table {
  headers: string[];
  rows: Row[];
  /** Rows that had fewer cells than the header — padded, and counted. */
  ragged: number;
}

/** RFC 4180, plus the defects that turn up in real supplier files. */
export function parseCsv(text: string): Table {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      record.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  const headerCells = nonEmpty.shift() ?? [];
  const headers = headerCells.map((header, position) => header.trim() || `column_${position + 1}`);

  let ragged = 0;
  const rows: Row[] = nonEmpty.map((cells) => {
    if (cells.length !== headers.length) ragged += 1;
    const row: Row = {};
    headers.forEach((header, position) => {
      row[header] = (cells[position] ?? "").trim();
    });
    return row;
  });

  return { headers, rows, ragged };
}

/** Quotes only what needs quoting, with CRLF like the spreadsheets people use. */
export function stringifyCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

/** Header lookup that does not care about case, spaces or punctuation. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function valueFor(row: Row, candidates: string[]): string {
  for (const candidate of candidates) {
    const wanted = normaliseHeader(candidate);
    for (const [header, value] of Object.entries(row)) {
      if (normaliseHeader(header) === wanted && value.trim()) return value.trim();
    }
  }
  return "";
}
