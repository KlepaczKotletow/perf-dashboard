import { describe, it, expect } from "vitest";
import { csvEscape, csvRow, csvFile, csvStreamResponse } from "./csv";

describe("csvEscape", () => {
  it("prefixes single-quote on formula-leading characters", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+cmd|'/c calc'")).toBe("'+cmd|'/c calc'");
    expect(csvEscape("-2+3")).toBe("'-2+3");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("\tTab")).toBe("'\tTab");
    expect(csvEscape("\rCR")).toBe('"\'\rCR"');
  });

  it("double-quotes cells containing quote, comma, or newline", () => {
    expect(csvEscape('has "quote"')).toBe('"has ""quote"""');
    expect(csvEscape("has,comma")).toBe('"has,comma"');
    expect(csvEscape("has\nnewline")).toBe('"has\nnewline"');
  });

  it("leaves normal cells untouched", () => {
    expect(csvEscape("plain text")).toBe("plain text");
    expect(csvEscape("123")).toBe("123");
    expect(csvEscape("")).toBe("");
  });

  it("renders null and undefined as empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("coerces numbers and booleans", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(true)).toBe("true");
  });
});

describe("csvRow + csvFile", () => {
  it("joins values with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("writes header + rows joined by newlines", () => {
    const out = csvFile(["name", "amount"], [["alice", "=evil"], ["bob,jr", 42]]);
    expect(out).toBe("name,amount\nalice,'=evil\n\"bob,jr\",42");
  });
});

describe("csvStreamResponse", () => {
  it("streams header followed by pages until empty", async () => {
    const rows = [
      { n: 1, s: "=danger" },
      { n: 2, s: "normal" },
      { n: 3, s: "has,comma" },
    ];
    const resp = csvStreamResponse({
      filename: "t.csv",
      header: ["n", "s"],
      pageSize: 2,
      fetchPage: async (offset, limit) => rows.slice(offset, offset + limit),
      toRow: (r) => [r.n, r.s],
    });
    const text = await resp.text();
    expect(text).toBe(
      'n,s\n1,\'=danger\n2,normal\n3,"has,comma"\n',
    );
    expect(resp.headers.get("Content-Type")).toContain("text/csv");
    expect(resp.headers.get("Content-Disposition")).toContain("t.csv");
  });

  it("stops when fetchPage returns short page", async () => {
    let pagesFetched = 0;
    const resp = csvStreamResponse({
      filename: "t.csv",
      header: ["x"],
      pageSize: 10,
      fetchPage: async () => {
        pagesFetched++;
        return [{ x: 1 }]; // single row, less than pageSize → loop ends
      },
      toRow: (r) => [r.x],
    });
    await resp.text();
    expect(pagesFetched).toBe(1);
  });

  it("terminates on empty initial page (no rows)", async () => {
    const resp = csvStreamResponse({
      filename: "t.csv",
      header: ["x"],
      pageSize: 100,
      fetchPage: async () => [],
      toRow: (r: { x: number }) => [r.x],
    });
    const text = await resp.text();
    expect(text).toBe("x\n");
  });

  it("surfaces fetchPage errors as stream errors", async () => {
    const resp = csvStreamResponse({
      filename: "t.csv",
      header: ["x"],
      pageSize: 10,
      fetchPage: async () => { throw new Error("boom"); },
      toRow: (r: { x: number }) => [r.x],
    });
    await expect(resp.text()).rejects.toThrow(/boom/);
  });
});
