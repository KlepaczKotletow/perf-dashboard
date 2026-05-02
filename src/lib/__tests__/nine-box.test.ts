import { describe, it, expect } from "vitest";
import { ratingToAxis, BOX_ROWS, BOX_COLS, gradeToBox, boxToGrade } from "../nine-box";

describe("nine-box helpers", () => {
  describe("ratingToAxis", () => {
    it("maps 1-5 ratings to row index 0|1|2", () => {
      expect(ratingToAxis(1)).toBe(0);
      expect(ratingToAxis(2)).toBe(0);
      expect(ratingToAxis(2.4)).toBe(0);
      expect(ratingToAxis(2.5)).toBe(1);
      expect(ratingToAxis(3)).toBe(1);
      expect(ratingToAxis(3.4)).toBe(1);
      expect(ratingToAxis(3.5)).toBe(2);
      expect(ratingToAxis(5)).toBe(2);
    });
    it("returns null for null/undefined", () => {
      expect(ratingToAxis(null)).toBeNull();
      expect(ratingToAxis(undefined as any)).toBeNull();
    });
  });

  describe("gradeToBox", () => {
    it("uses both axes when grade and potential present", () => {
      expect(gradeToBox("Exceeds Expectations", 4.5)).toEqual({ row: 2, col: 2 });
      expect(gradeToBox("Below Expectations", 4)).toEqual({ row: 2, col: 0 });
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
    it("maps each of the 9 boxes to a grade + potential", () => {
      expect(boxToGrade({ row: 2, col: 2 })).toEqual({ final_grade: "Exceeds Expectations", potential: 4 });
      expect(boxToGrade({ row: 1, col: 1 })).toEqual({ final_grade: "Meets Expectations", potential: 3 });
      expect(boxToGrade({ row: 0, col: 0 })).toEqual({ final_grade: "Below Expectations", potential: 2 });
    });
  });

  describe("constants", () => {
    it("BOX_ROWS and BOX_COLS each have 3 entries", () => {
      expect(BOX_ROWS).toHaveLength(3);
      expect(BOX_COLS).toHaveLength(3);
    });
  });
});
