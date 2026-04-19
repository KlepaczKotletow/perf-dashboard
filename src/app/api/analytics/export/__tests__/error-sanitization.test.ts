import { describe, it, expect } from "vitest";
import { sanitizeExportError } from "../error-sanitization";

describe("sanitizeExportError", () => {
  it("returns generic message for Error with SQL details", () => {
    const err = new Error('relation "users" does not exist at postgres://...');
    expect(sanitizeExportError(err)).toBe("Failed to export analytics");
  });

  it("returns generic message for unknown throws", () => {
    expect(sanitizeExportError("boom")).toBe("Failed to export analytics");
  });

  it("returns generic message for null/undefined", () => {
    expect(sanitizeExportError(null)).toBe("Failed to export analytics");
    expect(sanitizeExportError(undefined)).toBe("Failed to export analytics");
  });
});
