import { describe, it, expect } from "vitest";
import { ratingToAxis, BOX_ROWS, BOX_COLS, gradeToBox, boxToGrade } from "../nine-box";

describe("nine-box helpers", () => {
  describe("ratingToAxis", () => {
    it("maps 1-5 ratings to row index 0|1|2 with asymmetric HiPo cuts", () => {
      // Row 0 (Low Potential) — bottom decile, must be < 2
      expect(ratingToAxis(1)).toBe(0);
      expect(ratingToAxis(1.9)).toBe(0);
      // Row 1 (Core Player) — broad middle [2, 4.5)
      expect(ratingToAxis(2)).toBe(1);
      expect(ratingToAxis(2.5)).toBe(1);
      expect(ratingToAxis(3)).toBe(1);
      expect(ratingToAxis(3.5)).toBe(1);
      expect(ratingToAxis(4)).toBe(1);
      expect(ratingToAxis(4.4)).toBe(1);
      // Row 2 (High Potential) — top of scale only, ≥ 4.5
      expect(ratingToAxis(4.5)).toBe(2);
      expect(ratingToAxis(5)).toBe(2);
    });
    it("returns null for null/undefined", () => {
      expect(ratingToAxis(null)).toBeNull();
      // Test that the function handles unexpected null-like inputs at runtime
      // even when the type signature disallows them.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(ratingToAxis(undefined as any)).toBeNull();
    });
  });

  describe("gradeToBox", () => {
    it("uses both axes when grade and potential present", () => {
      // 4.5 lands in row 2 (HiPo) under the asymmetric cut
      expect(gradeToBox("Exceeds Expectations", 4.5)).toEqual({ row: 2, col: 2 });
      // 4 stays Core under the asymmetric cut (was row 2 under symmetric cuts)
      expect(gradeToBox("Below Expectations", 4)).toEqual({ row: 1, col: 0 });
      expect(gradeToBox("Meets Expectations", 3)).toEqual({ row: 1, col: 1 });
    });
    it("falls back to grade-implied row when potential missing", () => {
      expect(gradeToBox("Exceptional", null)).toEqual({ row: 2, col: 2 });
      expect(gradeToBox("Meets Expectations", null)).toEqual({ row: 1, col: 1 });
      expect(gradeToBox("Needs Improvement", null)).toEqual({ row: 0, col: 0 });
    });
    it("returns null for unrecognised grade", () => {
      expect(gradeToBox("Made Up Grade", 3)).toBeNull();
      expect(gradeToBox(null, 3)).toBeNull();
    });
  });

  describe("boxToGrade", () => {
    it("maps each of the 9 boxes to a grade + potential that round-trips", () => {
      expect(boxToGrade({ row: 2, col: 2 })).toEqual({ final_grade: "Exceeds Expectations", potential: 5 });
      expect(boxToGrade({ row: 1, col: 1 })).toEqual({ final_grade: "Meets Expectations", potential: 3 });
      expect(boxToGrade({ row: 0, col: 0 })).toEqual({ final_grade: "Below Expectations", potential: 1.5 });
    });
    it("centroids round-trip cleanly through ratingToAxis", () => {
      // Critical invariant: dragging a chip into row R must set a potential
      // value that ratingToAxis maps back to row R. Otherwise the chip would
      // jump visually after save.
      for (const row of [0, 1, 2] as const) {
        for (const col of [0, 1, 2] as const) {
          const { potential } = boxToGrade({ row, col });
          expect(ratingToAxis(potential)).toBe(row);
        }
      }
    });
  });

  describe("constants", () => {
    it("BOX_ROWS and BOX_COLS each have 3 entries", () => {
      expect(BOX_ROWS).toHaveLength(3);
      expect(BOX_COLS).toHaveLength(3);
    });
  });
});

describe("vocabulary compat", () => {
  it("accepts both Unsatisfactory and Needs Improvement as col 0", () => {
    expect(gradeToBox("Unsatisfactory", null)).toEqual({ row: 0, col: 0 });
    expect(gradeToBox("Needs Improvement", null)).toEqual({ row: 0, col: 0 });
  });
});
