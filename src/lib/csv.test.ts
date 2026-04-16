import { describe, it, expect } from "vitest";
import { csvEscape, csvRow, csvFile } from "./csv";

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
