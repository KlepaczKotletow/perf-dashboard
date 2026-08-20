import { describe, it, expect } from "vitest";
import { isOwedBy, owedBy, type OwedReviewInput } from "../review-queue";

const ME = "me-1";
const REPORT = "report-1";
const OTHER = "other-1";

function assignment(over: Partial<OwedReviewInput> = {}): OwedReviewInput {
  return {
    employeeId: REPORT,
    managerId: ME,
    reviewerId: null,
    assignmentType: "standard",
    status: "pending",
    cycleStatus: "active",
    ...over,
  };
}

describe("isOwedBy", () => {
  it("counts a pending manager review on an active cycle", () => {
    expect(isOwedBy(assignment(), ME)).toBe(true);
  });

  it("counts an in-progress review — started is not finished", () => {
    expect(isOwedBy(assignment({ status: "in_progress" }), ME)).toBe(true);
  });

  it("does not count a completed review", () => {
    expect(isOwedBy(assignment({ status: "completed" }), ME)).toBe(false);
  });

  it("does not count work on a cycle that is no longer active", () => {
    // Both terminal spellings exist in this database.
    expect(isOwedBy(assignment({ cycleStatus: "closed" }), ME)).toBe(false);
    expect(isOwedBy(assignment({ cycleStatus: "completed" }), ME)).toBe(false);
    expect(isOwedBy(assignment({ cycleStatus: "draft" }), ME)).toBe(false);
  });

  it("does not count someone else's review", () => {
    expect(isOwedBy(assignment(), OTHER)).toBe(false);
  });

  it("counts my own self-review", () => {
    expect(isOwedBy(assignment({ employeeId: ME, managerId: OTHER }), ME)).toBe(true);
  });

  it("counts upward feedback I am named on, and not upward feedback about my report", () => {
    const iOweUpward = assignment({
      assignmentType: "upward",
      employeeId: OTHER,
      managerId: null,
      reviewerId: ME,
    });
    expect(isOwedBy(iOweUpward, ME)).toBe(true);

    // My report being reviewed upward by *their* reports is not mine to write.
    const notMine = assignment({
      assignmentType: "upward",
      employeeId: REPORT,
      managerId: null,
      reviewerId: OTHER,
    });
    expect(isOwedBy(notMine, ME)).toBe(false);
  });

  it("counts nothing for an anonymous viewer", () => {
    expect(isOwedBy(assignment(), null)).toBe(false);
    expect(isOwedBy(assignment(), undefined)).toBe(false);
  });
});

describe("owedBy", () => {
  it("counts every active cycle, not one per person", () => {
    // The bug this replaces: my-team used `.find()`, so a report with an
    // assignment in two active cycles was counted once.
    const list = [
      assignment({ employeeId: REPORT }),
      assignment({ employeeId: REPORT }),
      assignment({ employeeId: "report-2" }),
    ];
    expect(owedBy(list, ME)).toHaveLength(3);
  });

  it("filters out completed, closed and not-mine in one pass", () => {
    const list = [
      assignment(),
      assignment({ status: "completed" }),
      assignment({ cycleStatus: "closed" }),
      assignment({ managerId: OTHER }),
    ];
    expect(owedBy(list, ME)).toHaveLength(1);
  });

  it("returns an empty list rather than throwing on an empty input", () => {
    expect(owedBy([], ME)).toEqual([]);
  });
});
