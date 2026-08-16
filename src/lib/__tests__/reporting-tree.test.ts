import { describe, it, expect } from "vitest";
import { reportingSubtree, scopeAssignmentsToViewer } from "../reporting-tree";

// ceo → vp → em → ic, plus a second branch and an unrelated org.
const ORG = [
  { id: "ceo", manager_id: null },
  { id: "vp", manager_id: "ceo" },
  { id: "em", manager_id: "vp" },
  { id: "ic", manager_id: "em" },
  { id: "vp2", manager_id: "ceo" },
  { id: "ic2", manager_id: "vp2" },
  { id: "stranger", manager_id: null },
];

describe("reportingSubtree", () => {
  it("walks the whole tree, not just direct reports", () => {
    expect(reportingSubtree(ORG, "ceo")).toEqual(
      new Set(["vp", "em", "ic", "vp2", "ic2"])
    );
  });

  it("excludes the root itself", () => {
    expect(reportingSubtree(ORG, "ceo").has("ceo")).toBe(false);
  });

  it("scopes a mid-level manager to their own branch only", () => {
    const sub = reportingSubtree(ORG, "vp");
    expect(sub).toEqual(new Set(["em", "ic"]));
    expect(sub.has("vp2")).toBe(false);
    expect(sub.has("ic2")).toBe(false);
  });

  it("returns an empty set for someone with no reports", () => {
    expect(reportingSubtree(ORG, "ic")).toEqual(new Set());
    expect(reportingSubtree(ORG, "stranger")).toEqual(new Set());
  });

  it("never includes people outside the tree", () => {
    expect(reportingSubtree(ORG, "ceo").has("stranger")).toBe(false);
  });

  it("terminates on a reporting cycle rather than hanging", () => {
    // The per-user edit form has no cycle guard, so a→b→a is creatable.
    const cyclic = [
      { id: "a", manager_id: "b" },
      { id: "b", manager_id: "a" },
      { id: "c", manager_id: "b" },
    ];
    const sub = reportingSubtree(cyclic, "a");
    expect(sub).toEqual(new Set(["b", "c"]));
    expect(sub.has("a")).toBe(false);
  });

  it("handles an empty org", () => {
    expect(reportingSubtree([], "ceo")).toEqual(new Set());
  });
});

describe("scopeAssignmentsToViewer", () => {
  const subtree = reportingSubtree(ORG, "vp"); // em, ic

  it("includes assignments for people in the reporting line", () => {
    const rows = [{ employee_id: "ic", manager_id: "em", reviewer_id: null }];
    expect(scopeAssignmentsToViewer(rows, subtree, "vp")).toHaveLength(1);
  });

  it("excludes assignments for people outside the reporting line", () => {
    const rows = [{ employee_id: "ic2", manager_id: "vp2", reviewer_id: null }];
    expect(scopeAssignmentsToViewer(rows, subtree, "vp")).toHaveLength(0);
  });

  it("includes reviews the viewer personally owns or is subject of", () => {
    const rows = [
      { employee_id: "stranger", manager_id: "vp", reviewer_id: null }, // owns it
      { employee_id: "stranger", manager_id: null, reviewer_id: "vp" }, // upward reviewer
      { employee_id: "vp", manager_id: "ceo", reviewer_id: null },      // about them
    ];
    expect(scopeAssignmentsToViewer(rows, subtree, "vp")).toHaveLength(3);
  });

  it("keeps an unrelated colleague's review out", () => {
    const rows = [{ employee_id: "stranger", manager_id: "ceo", reviewer_id: "ic2" }];
    expect(scopeAssignmentsToViewer(rows, subtree, "vp")).toHaveLength(0);
  });

  it("does not leak rows with a null employee_id", () => {
    const rows = [{ employee_id: null, manager_id: "ceo", reviewer_id: "ceo" }];
    expect(scopeAssignmentsToViewer(rows, subtree, "vp")).toHaveLength(0);
  });
});
