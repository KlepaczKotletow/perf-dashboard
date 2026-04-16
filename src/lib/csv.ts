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

/**
 * Build a streaming CSV Response that doesn't hold the full result set in
 * memory. Use when the underlying query could return tens of thousands of
 * rows. `fetchPage(offset, limit)` returns a batch of rows; the stream
 * continues until fetchPage returns an empty array.
 *
 * This keeps Vercel serverless memory flat regardless of row count — the
 * non-streaming csvFile() holds every row's string representation in memory
 * before returning it, which OOMs around ~100k rows.
 */
export function csvStreamResponse<TRow>({
  filename,
  header,
  pageSize = 500,
  fetchPage,
  toRow,
}: {
  filename: string;
  header: string[];
  pageSize?: number;
  fetchPage: (offset: number, limit: number) => Promise<TRow[]>;
  toRow: (row: TRow) => unknown[];
}): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Byte-order mark is optional for broad Excel compatibility, but we
        // leave it off so programmatic consumers don't see a spurious leading
        // character. Excel opens UTF-8 CSVs fine on recent versions.
        controller.enqueue(encoder.encode(csvRow(header) + "\n"));

        let offset = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const page = await fetchPage(offset, pageSize);
          if (page.length === 0) break;
          const chunk = page.map((r) => csvRow(toRow(r))).join("\n") + "\n";
          controller.enqueue(encoder.encode(chunk));
          if (page.length < pageSize) break;
          offset += pageSize;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
