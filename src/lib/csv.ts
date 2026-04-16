const DANGEROUS_LEADING = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\n\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (DANGEROUS_LEADING.test(s)) s = "'" + s;
  if (NEEDS_QUOTING.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

export function csvFile(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n");
}
