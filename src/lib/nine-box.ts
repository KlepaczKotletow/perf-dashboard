// Pure helpers for the 9-box calibration grid.
// X-axis (col): performance (final_grade)
// Y-axis (row): potential (numeric rating)
//   row 0 = bottom (Low Potential), row 2 = top (High Potential)
//   col 0 = left (Below), col 2 = right (Strong)

export const BOX_ROWS = ["Low Potential", "Core Player", "High Potential"] as const;
export const BOX_COLS = ["Below", "Solid", "Strong"] as const;

export type BoxCoord = { row: 0 | 1 | 2; col: 0 | 1 | 2 };

/**
 * Map a numeric rating (1..5) to the 9-box row index.
 *
 * Thresholds are asymmetric on purpose: a symmetric (2.5/3.5) cut would
 * expect ~33% of the workforce to land in High Potential, but CEB / Harvard
 * benchmarking puts true HiPo prevalence at ~3-5%. Calibrating the cuts so
 * "High Potential" requires top-of-scale (≥4.5) avoids the inflation that
 * symmetric cuts produce. See docs/research/2026-05-02-calibration-evidence-base.md.
 *
 *   r < 2  → row 0 (Low Potential)        — bottom decile
 *   r < 4.5 → row 1 (Core Player)         — broad middle (most employees)
 *   r ≥ 4.5 → row 2 (High Potential)      — top of scale only
 */
export function ratingToAxis(r: number | null | undefined): 0 | 1 | 2 | null {
  if (r === null || r === undefined) return null;
  if (r < 2) return 0;
  if (r < 4.5) return 1;
  return 2;
}

// Two vocabularies exist in stored data: the calibration page uses
// "Unsatisfactory" as the bottom grade; a since-removed older view used
// "Needs Improvement". Accept both so existing data with either label
// maps cleanly to the same box.
const GRADE_TO_COL: Record<string, 0 | 1 | 2> = {
  "Unsatisfactory": 0,
  "Needs Improvement": 0,
  "Below Expectations": 0,
  "Meets Expectations": 1,
  "Exceeds Expectations": 2,
  "Exceptional": 2,
};

// When potential is unknown, the grade implies a default row (matches column).
const GRADE_TO_DEFAULT_ROW: Record<string, 0 | 1 | 2> = {
  "Unsatisfactory": 0,
  "Needs Improvement": 0,
  "Below Expectations": 0,
  "Meets Expectations": 1,
  "Exceeds Expectations": 2,
  "Exceptional": 2,
};

/**
 * Compute the 9-box coordinate for an assignment given its grade and
 * (optional) potential rating. Returns null for unrecognised grades.
 */
export function gradeToBox(
  grade: string | null | undefined,
  potential: number | null | undefined,
): BoxCoord | null {
  if (!grade) return null;
  const col = GRADE_TO_COL[grade];
  if (col === undefined) return null;
  const potRow = ratingToAxis(potential);
  const row = (potRow ?? GRADE_TO_DEFAULT_ROW[grade]) as 0 | 1 | 2;
  return { row, col };
}

/**
 * Inverse: given a 9-box coordinate (a target box the user dragged a chip
 * into), propose a {final_grade, potential_rating} pair that snaps to that
 * box's centroid. Used when someone drags a chip and we need to write back.
 *
 * Potential centroids must round-trip cleanly through ratingToAxis: dragging
 * a chip into row 2 must set a value that ratingToAxis maps back to row 2,
 * otherwise the chip would visually jump after save.
 */
const COL_TO_GRADE: Record<0 | 1 | 2, string> = {
  0: "Below Expectations",
  1: "Meets Expectations",
  2: "Exceeds Expectations",
};
// 1.5 round-trips to row 0 (<2); 3 round-trips to row 1 ([2, 4.5)); 5 round-trips to row 2 (≥4.5).
const ROW_TO_POTENTIAL: Record<0 | 1 | 2, number> = { 0: 1.5, 1: 3, 2: 5 };

export function boxToGrade(coord: BoxCoord): { final_grade: string; potential: number } {
  return {
    final_grade: COL_TO_GRADE[coord.col],
    potential: ROW_TO_POTENTIAL[coord.row],
  };
}
