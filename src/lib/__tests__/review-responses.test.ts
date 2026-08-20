import { describe, it, expect } from "vitest";
import { normalizeComment, shouldPersistResponse } from "../review-responses";

describe("normalizeComment", () => {
  it("returns null for absent input", () => {
    expect(normalizeComment(null)).toBeNull();
    expect(normalizeComment(undefined)).toBeNull();
  });

  it("treats whitespace-only input as no input", () => {
    expect(normalizeComment("")).toBeNull();
    expect(normalizeComment("   ")).toBeNull();
    expect(normalizeComment("\n\t  \n")).toBeNull();
  });

  it("preserves the reviewer's own formatting rather than the trimmed copy", () => {
    // Trimming is only the emptiness *test*. Indentation and paragraph breaks
    // are deliberate and must survive the round trip.
    const written = "  Strengths:\n  - shipped the migration\n\n  Growth:\n  - delegation\n";
    expect(normalizeComment(written)).toBe(written);
  });
});

describe("shouldPersistResponse", () => {
  it("persists a rating with no comment", () => {
    expect(shouldPersistResponse({ rating: 4, comment: null })).toBe(true);
  });

  it("persists the lowest rating on the scale", () => {
    // Guards against a truthiness regression: rating 0 is out of range for the
    // CHECK, but 1 is valid and falsy-adjacent mistakes are easy to make here.
    expect(shouldPersistResponse({ rating: 1, comment: null })).toBe(true);
  });

  it("persists a comment with no rating — the bug this module exists for", () => {
    expect(
      shouldPersistResponse({ rating: null, comment: "Carried the incident review single-handed." })
    ).toBe(true);
  });

  it("skips a competency the reviewer never touched", () => {
    expect(shouldPersistResponse({ rating: null, comment: null })).toBe(false);
    expect(shouldPersistResponse({ rating: null, comment: "   " })).toBe(false);
  });

  it("still writes an untouched competency when a row already exists", () => {
    // Clearing a rating or a comment has to persist the clearance; skipping the
    // write would silently leave the previous value in the database.
    expect(
      shouldPersistResponse({ rating: null, comment: null, hasExistingRow: true })
    ).toBe(true);
  });

  it("does not treat an absent hasExistingRow as true", () => {
    expect(shouldPersistResponse({ rating: null, comment: null, hasExistingRow: false })).toBe(false);
    expect(shouldPersistResponse({ rating: null, comment: undefined })).toBe(false);
  });
});
